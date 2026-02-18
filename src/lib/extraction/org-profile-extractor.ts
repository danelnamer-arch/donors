/**
 * Extract a structured NGO profile from raw text using Gemini.
 *
 * Takes concatenated text from multiple sources (website, PDF, YouTube, social,
 * pasted text) and produces a structured profile matching the Organization model.
 */

import { callGemini } from "@/lib/gemini";
import { normalizeCauses } from "@/lib/utils/normalize-causes";
import type { SimilarOrg, ExistingDonor } from "@/lib/utils/org-helpers";
import {
  CAUSE_OPTIONS,
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
  israeliRegistrationNumber: string | null;
  causes: string[];
  targetAudience: string | null;
  geographicFocus: string[];
  similarOrgs: SimilarOrg[];
  existingDonors: ExistingDonor[];
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
  "name": "Full legal name of the organization IN ENGLISH. If the name is in Hebrew or another language, translate it to English.",
  "israeliRegistrationNumber": "Israeli nonprofit registration number (Mispar Amuta, e.g. '580123456') if found, otherwise null",
  "mission": "2-4 sentence mission statement synthesized from the content, in English",
  "website": "Official website URL if found",
  "country": "Primary country of operation (e.g. 'Israel', 'United States')",
  "size": one of [${SIZE_OPTIONS.map((s) => `"${s.value}"`).join(", ")}] or null,
  "annualBudgetRange": one of [${BUDGET_OPTIONS.map((b) => `"${b.value}"`).join(", ")}] or null,
  "causes": ["Select from EXACTLY these options: ${CAUSE_OPTIONS.join(", ")}"],
  "targetAudience": "A detailed free-text description of who this organization serves — their target populations, beneficiaries, and communities. Be specific and descriptive. Example: 'At-risk youth ages 14-18 in peripheral Israeli towns, Ethiopian-Israeli immigrant families, and single mothers in southern Israel'. Return null if unclear.",
  "geographicFocus": ["Select from EXACTLY these options: ${GEOGRAPHY_OPTIONS.join(", ")}"],
  "similarOrgs": [{"name": "Org name in English", "registrationNumber": "Israeli reg number if known", "website": "URL if known"}],
  "existingDonors": [{"name": "Donor/foundation name in English", "website": "URL if known"}],
  "politicalStance": "Infer the organization's political/ideological positioning from their activities, mission, partnerships, and public statements. Include: political leanings, ideological orientation, positions on controversial issues, religious/secular identity, and any advocacy stances. For Israeli orgs: stance on settlements, peace process, security, religious-secular divide, economic policy. Be specific — avoid simple left/right labels. Return null if unclear."
}

RULES:
- ALL names (organization name, similar orgs, donors) MUST be in English. Translate from Hebrew or other languages.
- causes and geographicFocus MUST only contain values from the lists above
- For causes: select ALL that apply based on the content, even if not explicitly stated
- For geographicFocus: if the org operates in Israel, include "Israel" plus any sub-regions that apply
- For size: infer from team size, employee count, or organizational scope if mentioned
- For annualBudgetRange: infer from the latest available financial data, revenue, or budget mentions
- For targetAudience: write a rich, descriptive paragraph about who the org serves. Do NOT use categories — use natural language.
- For similarOrgs: include peer organizations, partners, or competitors. Include their Israeli registration number (Mispar Amuta) if available. Include their website if available.
- For existingDonors: include donors, funders, foundations, or grant-makers. Include their website if available.
- For israeliRegistrationNumber: look for numbers that match Israeli nonprofit registration patterns (typically 9 digits starting with 58)
- For politicalStance: infer from the organization's stated mission, activities, partners, and language. Do NOT ask the user — infer from context.
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

    // Filter geography to only canonical values
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

    // Parse similar orgs — ensure they're valid objects with at least a name
    const similarOrgs: SimilarOrg[] = (parsed.similarOrgs ?? [])
      .filter((o: unknown) => typeof o === "object" && o !== null && typeof (o as Record<string, unknown>).name === "string")
      .map((o: Record<string, unknown>) => ({
        name: String(o.name),
        ...(o.registrationNumber ? { registrationNumber: String(o.registrationNumber) } : {}),
        ...(o.website ? { website: String(o.website) } : {}),
      }));

    // Parse existing donors — ensure they're valid objects with at least a name
    const existingDonors: ExistingDonor[] = (parsed.existingDonors ?? [])
      .filter((d: unknown) => typeof d === "object" && d !== null && typeof (d as Record<string, unknown>).name === "string")
      .map((d: Record<string, unknown>) => ({
        name: String(d.name),
        ...(d.website ? { website: String(d.website) } : {}),
      }));

    return {
      name: parsed.name ?? null,
      mission: parsed.mission ?? null,
      website: parsed.website ?? null,
      country: parsed.country ?? null,
      size,
      annualBudgetRange: budget,
      israeliRegistrationNumber: parsed.israeliRegistrationNumber ?? null,
      causes: normalizedCauses,
      targetAudience: parsed.targetAudience ?? null,
      geographicFocus: validGeography,
      similarOrgs,
      existingDonors,
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
      israeliRegistrationNumber: null,
      causes: [],
      targetAudience: null,
      geographicFocus: [],
      similarOrgs: [],
      existingDonors: [],
      politicalStance: null,
    };
  }
}
