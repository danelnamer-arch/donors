import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined;
};

export const openai =
  globalForOpenAI.openai ??
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

if (process.env.NODE_ENV !== "production") {
  globalForOpenAI.openai = openai;
}

/**
 * Generate an embedding vector for a text string.
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Generate a human-readable reasoning for why a donor matches an org.
 * This is what the user sees on the swipe card instead of a score.
 */
export async function generateMatchReasoning(
  orgProfile: {
    name: string;
    mission: string;
    causes: string[];
    targetAudience: string | null;
    geographicFocus: string[];
  },
  donorProfile: {
    name: string;
    description: string;
    causes: string[];
    targetPopulations: string[];
    geographicFocus: string[];
    pastGrants: { recipientName: string; amount?: number; purpose?: string }[];
  }
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a fundraising advisor helping NGOs find donors. Write a brief, compelling 2-3 sentence explanation of why this donor could be a good match for this organization. Focus on concrete connections: similar organizations they've supported, shared causes, overlapping populations served. Be specific, not generic. Do not mention scores or algorithms.`,
      },
      {
        role: "user",
        content: `Organization: ${orgProfile.name}
Mission: ${orgProfile.mission}
Causes: ${orgProfile.causes.join(", ")}
Target audience: ${orgProfile.targetAudience || "N/A"}
Geographic focus: ${orgProfile.geographicFocus.join(", ")}

Donor: ${donorProfile.name}
Description: ${donorProfile.description}
Causes: ${donorProfile.causes.join(", ")}
Target populations: ${donorProfile.targetPopulations.join(", ")}
Geographic focus: ${donorProfile.geographicFocus.join(", ")}
Recent grants: ${donorProfile.pastGrants
          .slice(0, 10)
          .map(
            (g) =>
              `${g.recipientName}${g.amount ? ` ($${g.amount.toLocaleString()})` : ""}${g.purpose ? ` - ${g.purpose}` : ""}`
          )
          .join("; ")}`,
      },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  return response.choices[0].message.content ?? "This donor aligns with your organization's mission and focus areas.";
}

/**
 * Extract structured donor data from raw research text using OpenAI.
 * Drop-in replacement for Gemini's extractDonorProfile — same signature, same return type.
 * Uses gpt-4o-mini with JSON mode for reliable structured extraction.
 */
export async function extractDonorProfileOpenAI(rawText: string, donorName: string): Promise<{
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  headquartersCountry: string | null;
  headquartersCity: string | null;
  activeRegions: string[];
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  totalGivingUsd: number | null;
  avgGrantSizeUsd: number | null;
  grants: { recipientName: string; amount: number | null; year: number | null; purpose: string | null }[];
  keyPeople: { name: string; role: string }[];
  applicationProcess: string | null;
}> {
  const prompt = `Extract structured data about "${donorName}" from the following research text. Return ONLY valid JSON.

Research text:
${rawText.slice(0, 30000)}

Return this exact JSON structure (use null for unknown fields, [] for empty arrays):
{
  "description": "2-3 sentence description of the organization",
  "website": "official website URL only",
  "email": "public contact email if found",
  "phone": "public phone if found",
  "headquartersCountry": "country where HQ is located",
  "headquartersCity": "city where HQ is located",
  "activeRegions": ["countries/regions where they actively give"],
  "causes": ["cause areas they fund"],
  "targetPopulations": ["populations they serve"],
  "geographicFocus": ["geographic areas of focus"],
  "totalGivingUsd": null or number in WHOLE US DOLLARS (e.g. 50000000 for $50M, never 50.0),
  "avgGrantSizeUsd": null or number in WHOLE US DOLLARS (e.g. 250000 for $250K, never 250),
  "grants": [{"recipientName": "...", "amount": null or number in WHOLE US DOLLARS (e.g. 1500000 for $1.5M, 50000 for $50K — NEVER shorthand), "year": null or number, "purpose": "..."}],
  "keyPeople": [{"name": "...", "role": "..."}],
  "applicationProcess": "how to apply for funding, if mentioned"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a structured data extraction specialist. Extract donor/foundation profiles from research text into precise JSON. Be accurate — never invent data. Use null for unknown fields.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0,
    });

    const content = response.choices[0].message.content ?? "{}";
    return JSON.parse(content);
  } catch (err) {
    console.error("[openai] Failed to extract donor profile:", err);
    return {
      description: null, website: null, email: null, phone: null,
      headquartersCountry: null, headquartersCity: null, activeRegions: [],
      causes: [], targetPopulations: [], geographicFocus: [],
      totalGivingUsd: null, avgGrantSizeUsd: null, grants: [],
      keyPeople: [], applicationProcess: null,
    };
  }
}

/**
 * Verify a website belongs to a given donor/foundation using OpenAI.
 * Drop-in replacement for Gemini's verifyWebsite.
 */
export async function verifyWebsiteOpenAI(
  donorName: string,
  claimedUrl: string,
  pageContent: string
): Promise<{ verified: boolean; confidence: number; reason: string }> {
  const prompt = `You are verifying whether a website belongs to a specific organization.

Organization name: "${donorName}"
Claimed website URL: ${claimedUrl}
Page content (first 5000 chars):
${pageContent.slice(0, 5000)}

Does this website belong to "${donorName}"? Consider:
1. Does the page mention the organization name (or a close variant)?
2. Is it the organization's official site (not a directory listing or news article)?
3. Does the content match what you'd expect from this type of organization?

Return ONLY valid JSON:
{"verified": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a website verification specialist. Determine if a website belongs to a specific organization. Be conservative — only verify if confident.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
      temperature: 0,
    });

    const content = response.choices[0].message.content ?? "{}";
    return JSON.parse(content);
  } catch {
    return { verified: false, confidence: 0, reason: "Failed to parse verification result" };
  }
}

/**
 * Analyze grant recipients to determine where a donor actually operates using OpenAI.
 * Drop-in replacement for Gemini's analyzeGrantGeography.
 */
export async function analyzeGrantGeographyOpenAI(
  donorName: string,
  grants: { recipientName: string; purpose: string | null }[]
): Promise<string[]> {
  if (grants.length === 0) return [];

  const grantList = grants
    .slice(0, 30)
    .map((g) => `${g.recipientName}${g.purpose ? ` — ${g.purpose}` : ""}`)
    .join("\n");

  const prompt = `Given these grants from "${donorName}", identify the countries and regions where they actively fund programs.

Grants:
${grantList}

Return ONLY a JSON object with a "regions" key containing an array of country/region names, e.g. {"regions": ["Israel", "United States", "Global"]}
Focus on where the recipients operate, not where they're registered.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a geographic analysis specialist. Determine where grant recipients operate based on their names and purposes.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0,
    });

    const content = response.choices[0].message.content ?? '{"regions": []}';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.regions) ? parsed.regions : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
