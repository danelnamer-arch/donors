/**
 * Google Gemini API client for structured data extraction and reasoning.
 * Used as an alternative/complement to OpenAI for donor research tasks.
 */

import { formatGrantAmount } from "@/lib/utils/format-amount";

interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function callGemini(
  messages: GeminiMessage[],
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = options?.model ?? "gemini-2.0-flash";
  const maxRetries = 6;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(
      `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.maxTokens ?? 4096,
          },
        }),
      }
    );

    if (response.ok) {
      const data: GeminiResponse = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    // Retry on 429 (rate limit) and 503 (overloaded) with exponential backoff
    if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
      // Base delay: 2s, 4s, 8s, 16s, 32s, 60s — with jitter
      const baseDelay = Math.min(2000 * Math.pow(2, attempt), 60000);
      const delay = baseDelay + Math.random() * 2000;
      console.warn(`[gemini] Rate limited (${response.status}), retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  throw new Error("Gemini API: max retries exceeded");
}

/**
 * Extract structured donor data from raw research text.
 * Gemini is excellent at structured extraction from messy text.
 */
export async function extractDonorProfile(rawText: string, donorName: string): Promise<{
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
  const prompt = `Extract structured data about "${donorName}" from the following research text. Return ONLY valid JSON, no markdown.

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

  const result = await callGemini([{ role: "user", parts: [{ text: prompt }] }]);

  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonStr = result.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error("[gemini] Failed to parse extraction result");
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
 * Verify a website belongs to a given donor/foundation.
 * Returns confidence score and the verified URL.
 */
export async function verifyWebsite(
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

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.1 }
  );

  try {
    const jsonStr = result.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return { verified: false, confidence: 0, reason: "Failed to parse verification result" };
  }
}

/**
 * Generate high-quality match reasoning using concrete donor data.
 * More specific than the OpenAI version — includes grant amounts, recipients.
 */
export async function generateMatchReasoning(params: {
  orgName: string;
  orgMission: string | null;
  orgCauses: string[];
  orgGeoFocus: string[];
  orgRawProfileText?: string | null;
  orgPoliticalStance?: string | null;
  donorName: string;
  donorType: string;
  donorDescription: string | null;
  donorCauses: string[];
  donorGeoFocus: string[];
  donorActiveRegions: string[];
  donorPoliticalStance?: string | null;
  topGrants: { recipientName: string; amount: number | null; year: number | null }[];
  totalGiving: number | null;
  grantCount: number;
}): Promise<string> {
  const grantDetails = params.topGrants
    .slice(0, 5)
    .map((g) => {
      const parts = [g.recipientName];
      if (g.amount) parts.push(formatGrantAmount(g.amount));
      if (g.year) parts.push(`(${g.year})`);
      return parts.join(" — ");
    })
    .join("\n");

  const prompt = `Write a 2-3 sentence explanation of why "${params.donorName}" is a good match for the NGO "${params.orgName}".

NGO profile:
- Mission: ${params.orgMission || "N/A"}
- Causes: ${params.orgCauses.join(", ")}
- Geographic focus: ${params.orgGeoFocus.join(", ")}${params.orgPoliticalStance ? `\n- Values/ideological orientation: ${params.orgPoliticalStance}` : ""}${params.orgRawProfileText ? `\n\nDetailed org profile (use to reference specific programs):\n${params.orgRawProfileText.slice(0, 2000)}` : ""}

Donor profile:
- Type: ${params.donorType}
- Description: ${params.donorDescription || "N/A"}
- Causes: ${params.donorCauses.join(", ")}
- Geographic reach: ${[...params.donorGeoFocus, ...params.donorActiveRegions].join(", ") || "N/A"}${params.donorPoliticalStance ? `\n- Values/ideological orientation: ${params.donorPoliticalStance}` : ""}
- Total giving: ${params.totalGiving ? `$${(params.totalGiving / 1_000_000).toFixed(1)}M` : "N/A"}
- Grant count: ${params.grantCount}
${grantDetails ? `\nRecent grants:\n${grantDetails}` : ""}

RULES:
- Be specific: mention actual grant recipients, dollar amounts, regions
- Never say "aligns well" or "shares your mission" without specifics
- If they gave to similar organizations, name them
- Never mention match scores or percentages
- Keep it to 2-3 sentences max
- If the donor operates in Israel or funds Israeli organizations, highlight that connection explicitly
- If the donor has funded organizations similar to the NGO in Israel, name those Israeli recipients
- For Israeli NGOs, emphasize any Israel-specific grant history, programs, or regional presence
- If a detailed org profile is provided, reference the org's specific programs and activities rather than generic cause labels
- If both the org and donor have values/ideological orientations, mention specific shared values or ideological connections. Frame it as "shared commitment to X" or "aligned on Y" — never use the word "political" directly. Be specific about the connection (e.g. "Both prioritize Israel's security agenda" rather than "Both are right-wing").
- If ideological stances conflict or are very different, do NOT mention ideology at all.`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.5, maxTokens: 300 }
  );

  return result.trim() || `${params.donorName} supports causes relevant to your organization's work.`;
}

/**
 * Analyze grant recipients to determine where a donor actually operates.
 * Returns countries/regions derived from grant data.
 */
export async function analyzeGrantGeography(
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

Return ONLY a JSON array of country/region names, e.g. ["Israel", "United States", "Global"]
Focus on where the recipients operate, not where they're registered.`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.1 }
  );

  try {
    const jsonStr = result.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return [];
  }
}
