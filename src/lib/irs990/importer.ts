/**
 * IRS 990 Data Importer
 * Imports US foundation grant data from ProPublica's Nonprofit Explorer API.
 * This is the richest free source of donor data for US foundations.
 *
 * ProPublica API docs: https://projects.propublica.org/nonprofits/api
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";

const PROPUBLICA_BASE_URL = "https://projects.propublica.org/nonprofits/api/v2";

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

/**
 * Map NTEE code to human-readable cause areas.
 * NTEE codes are the standard classification for nonprofits.
 */
function nteeToCauses(nteeCode: string): string[] {
  if (!nteeCode) return [];

  const majorGroup = nteeCode.charAt(0);
  const causeMap: Record<string, string[]> = {
    A: ["arts", "culture", "humanities"],
    B: ["education"],
    C: ["environment"],
    D: ["animal welfare"],
    E: ["health", "healthcare"],
    F: ["mental health"],
    G: ["disease research", "medical research"],
    H: ["medical research"],
    I: ["crime prevention", "public safety"],
    J: ["employment", "job training"],
    K: ["food", "agriculture", "nutrition"],
    L: ["housing", "shelter"],
    M: ["public safety", "disaster relief"],
    N: ["recreation", "sports"],
    O: ["youth development"],
    P: ["human services"],
    Q: ["international", "foreign affairs"],
    R: ["civil rights", "social action"],
    S: ["community development"],
    T: ["philanthropy", "grantmaking"],
    U: ["science", "technology"],
    V: ["social science research"],
    W: ["public affairs", "government"],
    X: ["religion"],
    Y: ["mutual benefit"],
    Z: ["unknown"],
  };

  return causeMap[majorGroup] ?? [];
}

/**
 * Import foundations from ProPublica that are relevant to Israeli NGOs.
 * Searches for foundations known to support Israel-related causes.
 */
export async function importIsraelRelatedFoundations(options?: {
  maxPages?: number;
  batchSize?: number;
}): Promise<{
  searched: number;
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const maxPages = options?.maxPages ?? 5;
  const batchSize = options?.batchSize ?? 25;
  const errors: string[] = [];
  let searched = 0;
  let imported = 0;
  let skipped = 0;

  // Search terms relevant to donors who support Israeli NGOs
  const searchTerms = [
    "Israel foundation",
    "Jewish philanthropy",
    "Israel grant",
    "Middle East peace foundation",
    "Jewish community foundation",
    "Israel education foundation",
    "Israel health foundation",
    "Israel social services",
    "Israel environment",
    "Israel arts culture",
  ];

  for (const term of searchTerms) {
    for (let page = 0; page < maxPages; page++) {
      try {
        const results = await searchProPublica(term, page);
        searched += results.organizations.length;

        if (results.organizations.length === 0) break;

        // Process in batches
        for (let i = 0; i < results.organizations.length; i += batchSize) {
          const batch = results.organizations.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(
            batch.map((org) => importSingleFoundation(org))
          );

          for (const result of batchResults) {
            if (result.status === "fulfilled") {
              if (result.value === "imported") imported++;
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
  }

  return { searched, imported, skipped, errors };
}

/**
 * Import a single foundation from ProPublica data.
 */
async function importSingleFoundation(
  org: ProPublicaOrg
): Promise<"imported" | "skipped"> {
  const ein = org.ein.toString();

  // Skip if already in database
  const existing = await prisma.donor.findUnique({ where: { ein } });
  if (existing) return "skipped";

  // Only import foundations/grantmakers (subsection code 3 = 501(c)(3))
  if (org.subsection_code !== 3) return "skipped";

  // Get detailed info
  let details: ProPublicaOrgDetail | null = null;
  try {
    details = await getOrgDetails(ein);
  } catch {
    // Continue with basic info if details fail
  }

  const causes = nteeToCauses(org.ntee_code);

  // Determine geographic focus based on search context
  const geographicFocus: string[] = [];
  const nameLower = org.name.toLowerCase();
  if (nameLower.includes("israel") || nameLower.includes("jewish") || nameLower.includes("zion")) {
    geographicFocus.push("Israel");
  }
  if (org.state) {
    geographicFocus.push("United States");
  }

  const donor = await prisma.donor.create({
    data: {
      name: org.name,
      type: "FOUNDATION",
      description: `${org.name} is a US-based foundation (EIN: ${ein}) located in ${org.city}, ${org.state}.`,
      country: "US",
      city: org.city,
      location: `${org.city}, ${org.state}`,
      causes,
      targetPopulations: [],
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
      dataSources: [
        {
          url: `https://projects.propublica.org/nonprofits/organizations/${ein}`,
          title: "ProPublica Nonprofit Explorer",
          fetchedAt: new Date().toISOString(),
        },
      ],
      dataQualityScore: 0.3, // Basic data only, needs enrichment
      researchStatus: "NEEDS_UPDATE",
      lastResearchedAt: new Date(),
    },
  });

  // Generate embedding
  const embeddingText = [
    org.name,
    `Foundation based in ${org.city}, ${org.state}`,
    causes.length ? `Focus areas: ${causes.join(", ")}` : null,
    geographicFocus.length ? `Geographic focus: ${geographicFocus.join(", ")}` : null,
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
