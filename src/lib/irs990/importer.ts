/**
 * IRS 990 Data Importer
 * Imports US foundation grant data from ProPublica's Nonprofit Explorer API.
 * This is the richest free source of donor data for US foundations.
 *
 * v2: Generalized to import across all philanthropic sectors, not just Israel-related.
 * Uses normalized cause taxonomy for consistency.
 *
 * ProPublica API docs: https://projects.propublica.org/nonprofits/api
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";
import { nteeToCauses } from "@/lib/utils/normalize-causes";
import { computeQualityScore } from "@/lib/validation/compute-quality-score";
import { donorCreateSchema } from "@/lib/validation/donor-schemas";

const PROPUBLICA_BASE_URL = "https://projects.propublica.org/nonprofits/api/v2";

// ============================================================
// SECTOR KEYWORDS — comprehensive search terms by sector
// ============================================================

export const SECTOR_KEYWORDS: Record<string, string[]> = {
  health: [
    "health foundation",
    "medical research foundation",
    "global health grant",
    "hospital foundation",
    "public health fund",
  ],
  education: [
    "education foundation",
    "scholarship fund",
    "education grant",
    "university foundation",
    "literacy foundation",
  ],
  environment: [
    "environmental foundation",
    "conservation foundation",
    "climate foundation",
    "nature conservancy",
    "wildlife fund",
  ],
  arts: [
    "arts foundation",
    "cultural foundation",
    "arts education fund",
    "museum foundation",
    "performing arts fund",
  ],
  humanRights: [
    "human rights foundation",
    "civil liberties fund",
    "social justice foundation",
    "civil rights fund",
    "racial equity foundation",
  ],
  poverty: [
    "poverty foundation",
    "anti-hunger fund",
    "economic development foundation",
    "community action fund",
    "homeless services",
  ],
  youth: [
    "youth development foundation",
    "children charity",
    "boys girls club foundation",
    "child welfare fund",
    "mentoring foundation",
  ],
  women: [
    "women foundation",
    "gender equality fund",
    "women empowerment foundation",
    "girls education fund",
  ],
  international: [
    "international development foundation",
    "global aid foundation",
    "world relief fund",
    "foreign assistance foundation",
  ],
  technology: [
    "technology foundation",
    "STEM education fund",
    "digital equity foundation",
    "computer science education",
  ],
  disability: [
    "disability foundation",
    "accessibility fund",
    "special needs foundation",
    "inclusive education fund",
  ],
  veterans: [
    "veterans foundation",
    "military families fund",
    "wounded warrior",
    "veteran services",
  ],
  elderly: [
    "aging foundation",
    "senior services fund",
    "elder care foundation",
  ],
  faith: [
    "Jewish philanthropy",
    "Christian foundation",
    "Islamic relief fund",
    "interfaith foundation",
    "religious charity",
  ],
  community: [
    "community foundation",
    "neighborhood foundation",
    "rural development fund",
    "civic foundation",
  ],
  disasterRelief: [
    "disaster relief foundation",
    "emergency response fund",
    "humanitarian aid foundation",
  ],
  criminalJustice: [
    "criminal justice foundation",
    "prison reform fund",
    "reentry services foundation",
  ],
  housing: [
    "affordable housing foundation",
    "homeless shelter fund",
    "housing development foundation",
  ],
  food: [
    "food bank foundation",
    "hunger relief fund",
    "agricultural foundation",
    "nutrition fund",
  ],
  science: [
    "science foundation",
    "research foundation",
    "scientific research fund",
  ],
  jewish: [
    "Jewish federation",
    "Jewish community foundation",
    "Jewish family services",
    "Jewish charitable fund",
    "Hillel foundation",
    "Chabad",
    "Hadassah",
    "Jewish national fund",
    "Israel bonds",
    "United Jewish Appeal",
  ],
  israel: [
    "Israel education foundation",
    "Israel health foundation",
    "Israel technology foundation",
    "Israel arts foundation",
    "Israel environment foundation",
    "Israel democracy foundation",
    "Israel peace foundation",
    "Israel poverty foundation",
    "friends of Israel foundation",
    "American friends of",
    "Israel philanthropy foundation",
    "Israel development foundation",
  ],
};

/**
 * US state to region mapping for richer geographic data.
 */
const STATE_REGIONS: Record<string, string> = {
  AL: "Southeast", AK: "West", AZ: "Southwest", AR: "South", CA: "West Coast",
  CO: "Mountain West", CT: "Northeast", DE: "Mid-Atlantic", FL: "Southeast",
  GA: "Southeast", HI: "West", ID: "Mountain West", IL: "Midwest",
  IN: "Midwest", IA: "Midwest", KS: "Central", KY: "South",
  LA: "South", ME: "Northeast", MD: "Mid-Atlantic", MA: "Northeast",
  MI: "Midwest", MN: "Midwest", MS: "South", MO: "Midwest",
  MT: "Mountain West", NE: "Central", NV: "West", NH: "Northeast",
  NJ: "Northeast", NM: "Southwest", NY: "Northeast", NC: "Southeast",
  ND: "Central", OH: "Midwest", OK: "Central", OR: "West Coast",
  PA: "Northeast", RI: "Northeast", SC: "Southeast", SD: "Central",
  TN: "South", TX: "South", UT: "Mountain West", VT: "Northeast",
  VA: "Mid-Atlantic", WA: "West Coast", WV: "South", WI: "Midwest",
  WY: "Mountain West", DC: "Mid-Atlantic",
};

// ============================================================
// TYPES
// ============================================================

interface ProPublicaOrg {
  ein: number;
  name: string;
  city: string;
  state: string;
  ntee_code: string;
  subsection_code: number;
  classification_codes: string;
  ruling_date: string;
  tax_period: number;
  asset_amount: number;
  income_amount: number;
  revenue_amount: number;
}

interface ProPublicaSearchResponse {
  total_results: number;
  organizations: ProPublicaOrg[];
}

interface ProPublicaFiling {
  tax_prd_yr: number;
  formtype: string;
  pdf_url: string;
  updated: string;
  totrevenue: number;
  totfuncexpns: number;
  totassetsend: number;
  totliabend: number;
  pct_compnsatncurrofcrs: number;
}

interface ProPublicaOrgDetail {
  organization: ProPublicaOrg & {
    ntee_code: string;
    raw_ntee_code: string;
  };
  filings_with_data: ProPublicaFiling[];
}

export interface ImportResult {
  searched: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Search ProPublica for foundations by keyword.
 */
async function searchProPublica(
  query: string,
  page: number = 0
): Promise<ProPublicaSearchResponse> {
  const url = `${PROPUBLICA_BASE_URL}/search.json?q=${encodeURIComponent(query)}&page=${page}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ProPublica API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get detailed information about a specific organization by EIN.
 */
async function getOrgDetails(ein: string): Promise<ProPublicaOrgDetail> {
  const url = `${PROPUBLICA_BASE_URL}/organizations/${ein}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ProPublica API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================
// IMPORT FUNCTIONS
// ============================================================

/**
 * Import foundations by sector.
 * Pass a specific sector key (e.g. "health", "education") or omit for all sectors.
 */
export async function importFoundationsBySector(options?: {
  sector?: string;
  maxPagesPerKeyword?: number;
  batchSize?: number;
  onProgress?: (msg: string) => void;
}): Promise<ImportResult> {
  const maxPages = options?.maxPagesPerKeyword ?? 1;
  const batchSize = options?.batchSize ?? 10;
  const onProgress = options?.onProgress ?? (() => {});
  const errors: string[] = [];
  let searched = 0;
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  // Get search terms for the requested sector(s)
  let searchTerms: string[];
  if (options?.sector && options.sector !== "all") {
    searchTerms = SECTOR_KEYWORDS[options.sector] ?? [];
    if (searchTerms.length === 0) {
      errors.push(`Unknown sector: ${options.sector}`);
      return { searched: 0, imported: 0, skipped: 0, duplicates: 0, errors };
    }
  } else {
    // All sectors
    searchTerms = Object.values(SECTOR_KEYWORDS).flat();
  }

  onProgress(`Starting import with ${searchTerms.length} search terms...`);

  for (let ti = 0; ti < searchTerms.length; ti++) {
    const term = searchTerms[ti];
    onProgress(`[${ti + 1}/${searchTerms.length}] Searching: "${term}"`);

    for (let page = 0; page < maxPages; page++) {
      try {
        const results = await searchProPublica(term, page);
        searched += results.organizations.length;

        if (results.organizations.length === 0) break;

        // Process in smaller batches to avoid overload
        for (let i = 0; i < results.organizations.length; i += batchSize) {
          const batch = results.organizations.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(
            batch.map((org) => importSingleFoundation(org))
          );

          for (const result of batchResults) {
            if (result.status === "fulfilled") {
              if (result.value === "imported") imported++;
              else if (result.value === "duplicate") duplicates++;
              else skipped++;
            } else {
              errors.push(result.reason?.message ?? "Unknown error");
            }
          }
        }

        // Rate limiting: wait between pages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        errors.push(
          `Search "${term}" page ${page}: ${error instanceof Error ? error.message : "failed"}`
        );
      }
    }

    // Rate limiting between search terms
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  onProgress(`Import complete: ${imported} imported, ${duplicates} duplicates, ${skipped} skipped`);
  return { searched, imported, skipped, duplicates, errors };
}

/**
 * Legacy function name — still works, calls the new generalized function.
 */
export async function importIsraelRelatedFoundations(options?: {
  maxPages?: number;
  batchSize?: number;
}): Promise<ImportResult> {
  return importFoundationsBySector({
    sector: "faith",
    maxPagesPerKeyword: options?.maxPages ?? 3,
    batchSize: options?.batchSize,
  });
}

/**
 * Import ALL sectors at once. This is the main bulk import function.
 * Expected yield: ~150 unique foundations.
 */
export async function importAllSectors(options?: {
  maxPagesPerKeyword?: number;
  onProgress?: (msg: string) => void;
}): Promise<ImportResult> {
  return importFoundationsBySector({
    sector: "all",
    maxPagesPerKeyword: options?.maxPagesPerKeyword ?? 1,
    batchSize: 10,
    onProgress: options?.onProgress,
  });
}

/**
 * Import a single foundation from ProPublica data.
 */
async function importSingleFoundation(
  org: ProPublicaOrg
): Promise<"imported" | "skipped" | "duplicate"> {
  const ein = org.ein.toString().padStart(9, "0");

  // Skip if already in database
  const existing = await prisma.donor.findUnique({ where: { ein } });
  if (existing) return "duplicate";

  // Import 501(c)(3) organizations (subsection_code == 3)
  // Use loose equality — ProPublica sometimes returns this as a string
  const code = Number(org.subsection_code);
  if (code && code !== 3) return "skipped";

  // Get detailed info
  let details: ProPublicaOrgDetail | null = null;
  try {
    details = await getOrgDetails(ein);
  } catch {
    // Continue with basic info if details fail
  }

  // Use the normalized cause taxonomy instead of raw labels
  const causes = nteeToCauses(org.ntee_code);

  // Build richer geographic focus using state → region mapping
  const geographicFocus: string[] = [];
  if (org.state) {
    geographicFocus.push("United States");
    const region = STATE_REGIONS[org.state];
    if (region) geographicFocus.push(region);
  }
  // Check name for international focus
  const nameLower = org.name.toLowerCase();
  if (nameLower.includes("international") || nameLower.includes("global") || nameLower.includes("world")) {
    geographicFocus.push("Global");
  }
  if (nameLower.includes("africa")) geographicFocus.push("Africa");
  if (nameLower.includes("asia")) geographicFocus.push("Asia");
  if (nameLower.includes("europe")) geographicFocus.push("Europe");
  if (nameLower.includes("latin") || nameLower.includes("america")) geographicFocus.push("Latin America");
  if (nameLower.includes("israel")) geographicFocus.push("Israel");

  // Build a richer description
  const description = buildDescription(org, causes, details);

  // Build donor data object
  const donorData = {
    name: org.name,
    type: "FOUNDATION" as const,
    description,
    country: "US",
    city: org.city,
    location: `${org.city}, ${org.state}`,
    causes,
    targetPopulations: [] as string[],
    geographicFocus,
    ein,
    irsData: JSON.parse(JSON.stringify({
      nteeCode: org.ntee_code,
      subsectionCode: org.subsection_code,
      assetAmount: org.asset_amount,
      incomeAmount: org.income_amount,
      revenueAmount: org.revenue_amount,
      rulingDate: org.ruling_date,
      latestFilings: details?.filings_with_data?.slice(0, 3) ?? [],
    })),
    totalGivingUsd: org.income_amount > 0 ? org.income_amount : undefined,
    dataSources: [
      {
        url: `https://projects.propublica.org/nonprofits/organizations/${ein}`,
        title: "ProPublica Nonprofit Explorer",
        fetchedAt: new Date().toISOString(),
      },
    ],
    researchStatus: "NEEDS_UPDATE" as const,
  };

  // Compute quality score deterministically instead of hardcoding 0.3
  const qualityScore = computeQualityScore({
    name: donorData.name,
    description: donorData.description,
    website: null,
    causes: donorData.causes,
    targetPopulations: donorData.targetPopulations,
    geographicFocus: donorData.geographicFocus,
    grantCount: 0,
    dataSources: donorData.dataSources,
  }).total;

  // Validate through Zod before writing to DB
  const parsed = donorCreateSchema.safeParse({
    ...donorData,
    dataQualityScore: qualityScore,
  });
  if (!parsed.success) {
    console.error(`[irs990] Validation failed for ${org.name}:`, parsed.error.issues.map(i => i.message).join(", "));
    return "skipped";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const donor = await prisma.donor.create({
    data: {
      ...parsed.data,
      lastResearchedAt: new Date(),
    } as any,
  });

  // Generate richer embedding text
  const embeddingText = [
    org.name,
    description,
    causes.length ? `Focus areas: ${causes.join(", ")}` : null,
    geographicFocus.length ? `Geographic focus: ${geographicFocus.join(", ")}` : null,
    `Located in ${org.city}, ${org.state}`,
  ]
    .filter(Boolean)
    .join(". ");

  try {
    const embedding = await generateEmbedding(embeddingText);
    await prisma.$executeRawUnsafe(
      `UPDATE "Donor" SET "missionEmbedding" = $1::vector WHERE id = $2`,
      JSON.stringify(embedding),
      donor.id
    );
  } catch {
    // Embedding generation can fail if OpenAI key is not set; continue anyway
  }

  return "imported";
}

/**
 * Build a richer description from ProPublica data.
 */
function buildDescription(
  org: ProPublicaOrg,
  causes: string[],
  details: ProPublicaOrgDetail | null
): string {
  const parts = [`${org.name} is a US-based foundation (EIN: ${org.ein}) located in ${org.city}, ${org.state}.`];

  if (causes.length > 0) {
    parts.push(`It focuses on ${causes.join(", ").toLowerCase()}.`);
  }

  if (org.asset_amount > 0) {
    const assets = org.asset_amount >= 1_000_000_000
      ? `$${(org.asset_amount / 1_000_000_000).toFixed(1)}B`
      : org.asset_amount >= 1_000_000
        ? `$${(org.asset_amount / 1_000_000).toFixed(1)}M`
        : `$${(org.asset_amount / 1_000).toFixed(0)}K`;
    parts.push(`Total assets: ${assets}.`);
  }

  if (details?.filings_with_data?.[0]?.totrevenue) {
    const rev = details.filings_with_data[0].totrevenue;
    const revStr = rev >= 1_000_000
      ? `$${(rev / 1_000_000).toFixed(1)}M`
      : `$${(rev / 1_000).toFixed(0)}K`;
    parts.push(`Annual revenue: ~${revStr}.`);
  }

  return parts.join(" ");
}

/**
 * Import a specific foundation by EIN.
 */
export async function importFoundationByEin(ein: string): Promise<string | null> {
  try {
    const details = await getOrgDetails(ein);
    const result = await importSingleFoundation(details.organization);
    if (result === "imported") {
      const donor = await prisma.donor.findUnique({ where: { ein } });
      return donor?.id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
