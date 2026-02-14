/**
 * GuideStar Israel — Structured Extraction
 *
 * Extracts structured organization data from raw GuideStar Israel page content.
 * Uses Gemini for Hebrew→English translation + structured extraction in a single call.
 *
 * Key fields:
 * - Mission statement (critical for similar org matching)
 * - Board members (critical for reverse donor discovery)
 * - Donors above 100K NIS (legally required to be public)
 * - Categories/causes (for peer org discovery)
 */

import { callGemini } from "@/lib/gemini";
import { normalizeCauses } from "@/lib/utils/normalize-causes";
import {
  CAUSE_OPTIONS,
  POPULATION_OPTIONS,
  GEOGRAPHY_OPTIONS,
} from "@/lib/constants/onboarding-options";

// ─── Interfaces ──────────────────────────────────────────────

export interface GuidestarILProfile {
  registrationNumber: string;
  name: string;
  nameEnglish?: string;
  mission?: string;
  missionEnglish?: string;
  yearFounded?: number;
  annualBudgetILS?: number;
  annualRevenueILS?: number;
  employeeCount?: number;
  volunteerCount?: number;
  categories: string[];
  normalizedCauses: string[];
  description?: string;
  descriptionEnglish?: string;
  boardMembers: string[];
  executiveDirector?: string;
  topDonors: string[];
  donorDetails: { name: string; amountILS?: number; year?: number }[];
  website?: string;
  address?: string;
  phone?: string;
  email?: string;
  targetPopulations: string[];
  geographicFocus: string[];
  isProperlyManaged?: boolean;
  status?: string;
}

// Default ILS to USD exchange rate (approximate)
const ILS_TO_USD = 0.27;

/**
 * Extract structured data from raw GuideStar Israel page content.
 * Handles Hebrew content — translates to English in the same Gemini call.
 */
export async function extractGuidestarProfile(
  rawContent: string,
  registrationNumber: string
): Promise<GuidestarILProfile> {
  const truncated = rawContent.slice(0, 25000);

  const prompt = `You are extracting structured data about an Israeli nonprofit organization from a GuideStar Israel (guidestar.org.il) page.

The content is likely in Hebrew. Translate all Hebrew text to English in your response.

Return ONLY valid JSON matching this exact structure (use null for unknown fields, [] for empty arrays):

{
  "registrationNumber": "${registrationNumber}",
  "name": "Organization name in Hebrew",
  "nameEnglish": "Organization name translated to English",
  "mission": "Mission statement in Hebrew (if found)",
  "missionEnglish": "Mission statement translated to English — be thorough, capture the full mission",
  "yearFounded": null or number (e.g. 1995),
  "annualBudgetILS": null or number in whole shekels (e.g. 5000000 for 5M NIS),
  "annualRevenueILS": null or number in whole shekels,
  "employeeCount": null or number,
  "volunteerCount": null or number,
  "categories": ["GuideStar Israel categories as listed on the page, in Hebrew and English"],
  "normalizedCauses": ["Map to EXACTLY these options: ${CAUSE_OPTIONS.join(", ")}"],
  "description": "Description or 'about' text in Hebrew",
  "descriptionEnglish": "Description translated to English",
  "boardMembers": ["Full names of all board members / office holders listed"],
  "executiveDirector": "Name of CEO / Executive Director / מנכ\"ל if listed",
  "topDonors": ["Names of major donors/funders listed in reports (donations > 100K NIS are public by Israeli law)"],
  "donorDetails": [{"name": "Donor name", "amountILS": null or number in whole shekels, "year": null or number}],
  "website": "Official website URL if found",
  "address": "Address if found",
  "phone": "Phone number if found",
  "email": "Email if found",
  "targetPopulations": ["Select from EXACTLY these options: ${POPULATION_OPTIONS.join(", ")}"],
  "geographicFocus": ["Select from EXACTLY these options: ${GEOGRAPHY_OPTIONS.join(", ")}"],
  "isProperlyManaged": true/false (ניהול תקין certification),
  "status": "active/dissolved/other"
}

RULES:
- normalizedCauses MUST only contain values from the list above
- targetPopulations MUST only contain values from the list above
- geographicFocus MUST only contain values from the list above
- For boardMembers: extract ALL names of office holders (נושאי משרה), board members (חברי ועד), and directors
- For topDonors: extract ALL donor names from financial reports. Israeli law requires disclosure of donations above 100,000 NIS.
- For donorDetails: if specific amounts are mentioned alongside donor names, include them
- If the text mentions the organization's mission (מטרות / ייעוד / חזון), extract it fully — this is critical
- For categories: list both the Hebrew category name and English translation
- Translate everything to English but preserve Hebrew names of people and the organization
- Financial amounts should be in WHOLE shekels (not thousands or millions abbreviated)
- "ניהול תקין" means "properly managed" certification from the Registrar of Associations

GuideStar Israel page content:
${truncated}`;

  const result = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    { model: "gemini-2.0-flash", temperature: 0.15, maxTokens: 4096 }
  );

  try {
    const jsonStr = result
      .replace(/```json?\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(jsonStr);

    // Post-process: normalize causes through our taxonomy
    const normalizedCauses = normalizeCauses(parsed.normalizedCauses ?? parsed.categories ?? []);

    // Filter populations and geography to canonical values
    const validPopulations = (parsed.targetPopulations ?? []).filter(
      (p: string) => (POPULATION_OPTIONS as readonly string[]).includes(p)
    );
    const validGeography = (parsed.geographicFocus ?? []).filter(
      (g: string) => (GEOGRAPHY_OPTIONS as readonly string[]).includes(g)
    );

    return {
      registrationNumber,
      name: parsed.name ?? "",
      nameEnglish: parsed.nameEnglish ?? undefined,
      mission: parsed.mission ?? undefined,
      missionEnglish: parsed.missionEnglish ?? undefined,
      yearFounded: parsed.yearFounded ?? undefined,
      annualBudgetILS: parsed.annualBudgetILS ?? undefined,
      annualRevenueILS: parsed.annualRevenueILS ?? undefined,
      employeeCount: parsed.employeeCount ?? undefined,
      volunteerCount: parsed.volunteerCount ?? undefined,
      categories: parsed.categories ?? [],
      normalizedCauses,
      description: parsed.description ?? undefined,
      descriptionEnglish: parsed.descriptionEnglish ?? undefined,
      boardMembers: parsed.boardMembers ?? [],
      executiveDirector: parsed.executiveDirector ?? undefined,
      topDonors: parsed.topDonors ?? [],
      donorDetails: parsed.donorDetails ?? [],
      website: parsed.website ?? undefined,
      address: parsed.address ?? undefined,
      phone: parsed.phone ?? undefined,
      email: parsed.email ?? undefined,
      targetPopulations: validPopulations,
      geographicFocus: validGeography,
      isProperlyManaged: parsed.isProperlyManaged ?? undefined,
      status: parsed.status ?? undefined,
    };
  } catch (err) {
    console.error("[guidestar-il] Failed to parse extraction result:", err instanceof Error ? err.message : err);
    return {
      registrationNumber,
      name: "",
      categories: [],
      normalizedCauses: [],
      boardMembers: [],
      topDonors: [],
      donorDetails: [],
      targetPopulations: [],
      geographicFocus: [],
    };
  }
}

/**
 * Convert ILS amount to USD using approximate exchange rate.
 */
export function ilsToUsd(amountILS: number): number {
  return Math.round(amountILS * ILS_TO_USD);
}

/**
 * Format a GuideStar IL profile as text suitable for embedding or further extraction.
 */
export function profileToText(profile: GuidestarILProfile): string {
  const parts: string[] = [];

  parts.push(`Organization: ${profile.nameEnglish || profile.name}`);

  if (profile.missionEnglish || profile.mission) {
    parts.push(`Mission: ${profile.missionEnglish || profile.mission}`);
  }

  if (profile.descriptionEnglish || profile.description) {
    parts.push(`Description: ${profile.descriptionEnglish || profile.description}`);
  }

  if (profile.normalizedCauses.length > 0) {
    parts.push(`Causes: ${profile.normalizedCauses.join(", ")}`);
  }

  if (profile.targetPopulations.length > 0) {
    parts.push(`Target Populations: ${profile.targetPopulations.join(", ")}`);
  }

  if (profile.geographicFocus.length > 0) {
    parts.push(`Geographic Focus: ${profile.geographicFocus.join(", ")}`);
  }

  if (profile.boardMembers.length > 0) {
    parts.push(`Board Members: ${profile.boardMembers.join(", ")}`);
  }

  if (profile.topDonors.length > 0) {
    parts.push(`Major Donors: ${profile.topDonors.join(", ")}`);
  }

  if (profile.annualBudgetILS) {
    const budgetUsd = ilsToUsd(profile.annualBudgetILS);
    parts.push(`Annual Budget: ${profile.annualBudgetILS.toLocaleString()} NIS (~$${budgetUsd.toLocaleString()} USD)`);
  }

  return parts.join("\n");
}
