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
    targetPopulations: string[];
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
Target populations: ${orgProfile.targetPopulations.join(", ")}
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
