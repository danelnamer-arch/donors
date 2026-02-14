/**
 * Extract a structured NGO profile from raw text using Gemini.
 *
 * Takes concatenated text from multiple sources (website, PDF, YouTube, social,
 * pasted text) and produces a structured profile matching the Organization model.
 */

import { callGemini } from "@/lib/gemini";
import { normalizeCauses } from "@/lib/utils/normalize-causes";
import {
  CAUSE_OPTIONS,
  POPULATION_OPTIONS,
  GEOGRAPHY_OPTIONS,
  SIZE_OPTIONS,
  BUDGET_OPTIONS,
} from "@/lib/constants/onboarding-options";

export interface ExtractedOrgProfile {
  name: string | null;
  mission: string | null;
  website: string | null;
  country: string | null;
  size: string | null;
  annualBudgetRange: string | null;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  similarOrgNames: string[];
  existingDonorNames: string[];
  politicalStance: string | null;
}

/**
 * Extract a structured org profile from raw text.
 * Uses Gemini with low temperature for reliable structured extraction.
 */
export async function extractOrgProfile(
  rawText: string
): Promise<ExtractedOrgProfile> {
  const truncated = rawText.slice(0, 30000);

  const prompt = `You are extracting structured data about a nonprofit organization from the text below.

The text may come from multiple sources: website pages, PDF documents, social media, YouTube descriptions, or pasted text. Synthesize ALL sources into a single coherent profile.

Return ONLY valid JSON matching this exact structure (use null for unknown fields, [] for empty arrays):

{
  "name": "Full legal name of the organization",
  "mission": "2-4 sentence mission statement synthesized from the content",
  "website": "Official website URL if found",
  "country": "Primary country of operation (e.g. 'Israel', 'United States')",
  "size": one of [${SIZE_OPTIONS.map((s) => `"${s.value}"`).join(", ")}] or null,
  "annualBudgetRange": one of [${BUDGET_OPTIONS.map((b) => `"${b.value}"`).join(", ")}] or null,
  "causes": ["Select from EXACTLY these options: ${CAUSE_OPTIONS.join(", ")}"],
  "targetPopulations": ["Select from EXACTLY these options: ${POPULATION_OPTIONS.join(", ")}"],
  "geographicFocus": ["Select from EXACTLY these options: ${GEOGRAPHY_OPTIONS.join(", ")}"],
  "similarOrgNames": ["Names of similar organizations mentioned or implied"],
  "existingDonorNames": ["Names of donors, funders, or grant-makers mentioned"],
  "politicalStance": "Infer the organization's political/ideological positioning from their activities, mission, partnerships, and public statements. Include: political leanings, ideological orientation, positions on controversial issues, religious/secular identity, and any advocacy stances. For Israeli orgs: stance on settlements, peace process, security, religious-secular divide, economic policy. Be specific — avoid simple left/right labels. Return null if unclear."
}

RULES:
- causes, targetPopulations, and geographicFocus MUST only contain values from the lists above
- For causes: select ALL that apply based on the content, even if not explicitly stated
- For geographicFocus: if the org operates in Israel, include "Israel" plus any sub-regions that apply
- For size: infer from team size, employee count, or organizational scope if mentioned
- For annualBudgetRange: infer from financial data, revenue, or budget mentions
- If the text mentions donors, funders, foundations, or grant-makers, list them in existingDonorNames
- If the text mentions peer organizations or competitors, list them in similarOrgNames
- For politicalStance: infer from the organization's stated mission, activities, partners, and language. Do NOT ask the user — infer from context. Look for signals like: advocacy positions, partner organizations, funding sources, geographic focus within Israel, religious language, peace/security framing.
- If the text is in Hebrew or another language, still extract and translate all fields to English
- Be thorough — the more data you extract, the better the donor matching will be

Source text:
${truncated}`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { model: "gemini-2.0-flash", temperature: 0.2 }
  );

  try {
    const jsonStr = result
      .replace(/```json?\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr);

    // Post-process: normalize causes through our taxonomy
    const normalizedCauses = normalizeCauses(parsed.causes ?? []);

    // Filter populations and geography to only canonical values
    const validPopulations = (parsed.targetPopulations ?? []).filter(
      (p: string) => (POPULATION_OPTIONS as readonly string[]).includes(p)
    );
    const validGeography = (parsed.geographicFocus ?? []).filter(
      (g: string) => (GEOGRAPHY_OPTIONS as readonly string[]).includes(g)
    );

    // Validate size against allowed values
    const validSizes = SIZE_OPTIONS.map((s) => s.value);
    const size = validSizes.includes(parsed.size) ? parsed.size : null;

    // Validate budget against allowed values
    const validBudgets = BUDGET_OPTIONS.map((b) => b.value);
    const budget = validBudgets.includes(parsed.annualBudgetRange)
      ? parsed.annualBudgetRange
      : null;

    return {
      name: parsed.name ?? null,
      mission: parsed.mission ?? null,
      website: parsed.website ?? null,
      country: parsed.country ?? null,
      size,
      annualBudgetRange: budget,
      causes: normalizedCauses,
      targetPopulations: validPopulations,
      geographicFocus: validGeography,
      similarOrgNames: parsed.similarOrgNames ?? [],
      existingDonorNames: parsed.existingDonorNames ?? [],
      politicalStance: parsed.politicalStance ?? null,
    };
  } catch {
    console.error("[extraction] Failed to parse Gemini extraction result");
    return {
      name: null,
      mission: null,
      website: null,
      country: null,
      size: null,
      annualBudgetRange: null,
      causes: [],
      targetPopulations: [],
      geographicFocus: [],
      similarOrgNames: [],
      existingDonorNames: [],
      politicalStance: null,
    };
  }
}
