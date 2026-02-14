/**
 * Marathon Discovery — Target Definitions
 *
 * 65+ discovery targets organized across 5 phases,
 * designed to grow the DB from ~55 to ~500 donors.
 */

import type { DiscoveryTarget } from "./batch-discovery";
import type { MarathonPhase, DirectNameTarget } from "./marathon-types";

// ═══════════════════════════════════════════════════════════════
// PHASE 2: Israel & Jewish Philanthropy
// ═══════════════════════════════════════════════════════════════

/** Prong A — Cause-based discovery via runDiscoveryPipeline */
const ISRAEL_DISCOVERY_TARGETS: DiscoveryTarget[] = [
  // Israeli Foundations by Sector
  { cause: "Israeli philanthropy foundations", region: "Israel" },
  { cause: "Israeli social change organizations and nonprofits", region: "Israel" },
  { cause: "education foundations and grants", region: "Israel" },
  { cause: "health and medical research foundations", region: "Israel" },
  { cause: "technology and innovation grants", region: "Israel" },
  { cause: "environment and sustainability foundations", region: "Israel" },
  { cause: "arts culture and heritage foundations", region: "Israel" },
  { cause: "coexistence peace building Arab Jewish shared society", region: "Israel" },

  // Israeli Government Grant Bodies
  { cause: "government grants for nonprofits and social organizations", region: "Israel" },
  { cause: "Israel Science Foundation ISF research grants", region: "Israel" },
  { cause: "Israel Innovation Authority startup and R&D funding", region: "Israel" },

  // Israeli HNW Individuals
  { cause: "Israeli philanthropists and major donors", region: "Israel" },
  { cause: "Israeli tech billionaire philanthropy and giving", region: "Israel" },

  // American Israel-Focused
  { cause: "American foundations supporting Israel nonprofits", region: "United States" },
  { cause: "Jewish federation Israel programs and grants", region: "United States" },
  { cause: "pro-Israel philanthropy foundations", region: "United States" },
  { cause: "Israel diaspora philanthropy and giving", region: "Global" },
  { cause: "Christian philanthropy supporting Israel", region: "United States" },
];

/** Prong B — Direct-name research for known Israeli/Jewish donors */
const ISRAEL_DIRECT_NAMES: DirectNameTarget[] = [
  // Israeli Foundations
  { name: "Yad Hanadiv - Rothschild Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Ted Arison Family Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Sacta-Rashi Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Azrieli Foundation", type: "FOUNDATION", country: "Israel", website: "azrielifoundation.org" },
  { name: "Beracha Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Portland Trust", type: "FOUNDATION", country: "Israel", website: "portlandtrust.org" },
  { name: "Pears Foundation", type: "FOUNDATION", country: "United Kingdom", website: "pearsfoundation.org.uk" },
  { name: "Edmond de Rothschild Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Gandyr Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Lev Leviev Foundation", type: "FOUNDATION", country: "Israel" },
  { name: "Zimin Foundation", type: "FOUNDATION", country: "Israel" },

  // Israeli HNW Individuals
  { name: "Stef Wertheimer", type: "INDIVIDUAL", country: "Israel" },
  { name: "Eyal Ofer philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Idan Ofer philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Sylvan Adams philanthropy", type: "INDIVIDUAL", country: "Israel" },
  { name: "Morris Kahn philanthropy", type: "INDIVIDUAL", country: "Israel" },

  // Israeli Government / Quasi-Government
  { name: "Israel Science Foundation", type: "GOVERNMENT", country: "Israel", website: "isf.org.il" },
  { name: "Israel Innovation Authority", type: "GOVERNMENT", country: "Israel", website: "innovationisrael.org.il" },
  { name: "Mifal HaPayis - Israel National Lottery", type: "GOVERNMENT", country: "Israel" },
  { name: "Jewish Agency for Israel", type: "OTHER", country: "Israel", website: "jewishagency.org" },
  { name: "JDC - American Jewish Joint Distribution Committee", type: "OTHER", country: "Israel", website: "jdc.org" },

  // Israel-Focused American Donors
  { name: "Marcus Foundation", type: "FOUNDATION", country: "United States" },
  { name: "Adelson Family Foundation", type: "FOUNDATION", country: "United States" },
  { name: "AVI CHAI Foundation", type: "FOUNDATION", country: "United States" },
  { name: "One8 Foundation", type: "FOUNDATION", country: "United States" },
  { name: "Charles and Lynn Schusterman Family Philanthropies", type: "FOUNDATION", country: "United States" },
  { name: "Klarman Family Foundation", type: "FOUNDATION", country: "United States" },
  { name: "Helmsley Charitable Trust", type: "FOUNDATION", country: "United States" },
  { name: "Jack Abraham and Mandy Patinkin Foundation", type: "FOUNDATION", country: "United States" },
  { name: "Crown Family Philanthropies", type: "FOUNDATION", country: "United States" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 3: American Expansion
// ═══════════════════════════════════════════════════════════════

const AMERICAN_EXPANSION_TARGETS: DiscoveryTarget[] = [
  // Major American Foundations
  { cause: "largest US private foundations philanthropy 2024", region: "United States" },
  { cause: "family foundation philanthropy United States", region: "United States" },
  { cause: "US donor-advised fund sponsors and community foundations", region: "United States" },

  // American HNW Individuals
  { cause: "American billionaire philanthropists giving pledge signers", region: "United States" },
  { cause: "tech industry philanthropists Silicon Valley", region: "United States" },
  { cause: "Wall Street philanthropy hedge fund philanthropic donors", region: "United States" },

  // Corporate Foundations
  { cause: "Google.org corporate philanthropy and grants", region: "Global" },
  { cause: "Microsoft Philanthropies corporate giving programs", region: "Global" },
  { cause: "Salesforce Foundation corporate grants", region: "Global" },
  { cause: "Meta Chan Zuckerberg Initiative philanthropy", region: "Global" },
  { cause: "Amazon corporate social responsibility philanthropy", region: "Global" },
  { cause: "Apple community grants and philanthropy", region: "Global" },

  // Gap Sectors (zero coverage in current DB)
  { cause: "disability rights and inclusion foundations grants", region: "United States" },
  { cause: "veteran support foundations and military family grants", region: "United States" },
  { cause: "animal welfare and rights foundations grants", region: "United States" },
  { cause: "LGBTQ foundation grants and donors", region: "United States" },
  { cause: "mental health foundations and grants", region: "United States" },

  // Regional US Coverage
  { cause: "midwest philanthropy foundations Chicago Detroit", region: "United States" },
  { cause: "southern philanthropy foundations Atlanta Houston", region: "United States" },
  { cause: "New England philanthropy foundations Boston", region: "United States" },
  { cause: "Texas philanthropy foundations Houston Dallas", region: "United States" },
  { cause: "California philanthropy foundations Bay Area Los Angeles", region: "United States" },

  // Sector Gaps
  { cause: "democracy governance civic engagement foundations", region: "United States" },
  { cause: "immigration and refugee support foundations grants", region: "United States" },
  { cause: "food security hunger relief agriculture foundations", region: "United States" },
  { cause: "science and medical research foundations grants", region: "United States" },
  { cause: "housing homelessness community development foundations", region: "United States" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE 4: Federations & Community Foundations
// ═══════════════════════════════════════════════════════════════

const FEDERATION_TARGETS: DiscoveryTarget[] = [
  // Jewish Federations
  { cause: "Jewish federations United States JFNA major grants", region: "United States" },
  { cause: "Jewish federation philanthropy New York Los Angeles Chicago", region: "United States" },
  { cause: "Combined Jewish Philanthropies CJP Boston Jewish federation", region: "United States" },
  { cause: "Jewish federation grants Israel social services education", region: "United States" },

  // US Community Foundations
  { cause: "community foundation Silicon Valley San Francisco Bay Area", region: "United States" },
  { cause: "community foundation New York City philanthropy", region: "United States" },
  { cause: "community foundation Chicago Cleveland philanthropic", region: "United States" },
  { cause: "community foundation Texas Florida grants", region: "United States" },
  { cause: "community foundation Pacific Northwest Seattle Portland", region: "United States" },

  // International Jewish Organizations
  { cause: "Keren Hayesod United Israel Appeal campaigns", region: "Global" },
  { cause: "World ORT education network global grants", region: "Global" },
  { cause: "international Jewish philanthropy organizations grants", region: "Global" },
];

// ═══════════════════════════════════════════════════════════════
// PHASE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const MARATHON_PHASES: MarathonPhase[] = [
  {
    number: 1,
    name: "IRS 990 Bulk Import (US Foundations)",
    targets: [], // Phase 1 uses the IRS importer directly, not discovery targets
    delayBetweenMs: 0, // Built-in delays in the importer
    expectedYield: 250,
    strategy: "irs990",
  },
  {
    number: 2,
    name: "Israel & Jewish Philanthropy Deep Discovery",
    targets: ISRAEL_DISCOVERY_TARGETS,
    directNames: ISRAEL_DIRECT_NAMES,
    delayBetweenMs: 8000,
    expectedYield: 70,
    strategy: "two-prong",
  },
  {
    number: 3,
    name: "American Expansion",
    targets: AMERICAN_EXPANSION_TARGETS,
    delayBetweenMs: 8000,
    expectedYield: 100,
    strategy: "discovery",
  },
  {
    number: 4,
    name: "Federations & Community Foundations",
    targets: FEDERATION_TARGETS,
    delayBetweenMs: 8000,
    expectedYield: 35,
    strategy: "discovery",
  },
  {
    number: 5,
    name: "Enrichment Pass (Low-Quality Donors)",
    targets: [], // Phase 5 queries DB for low-quality donors
    delayBetweenMs: 15000,
    expectedYield: 0, // Enrichment doesn't add new donors
    strategy: "enrichment",
  },
];

/**
 * Get a specific phase by number.
 */
export function getPhase(number: number): MarathonPhase | undefined {
  return MARATHON_PHASES.find((p) => p.number === number);
}

/**
 * Get total expected yield across all phases.
 */
export function getTotalExpectedYield(): number {
  return MARATHON_PHASES.reduce((sum, p) => sum + p.expectedYield, 0);
}

/**
 * Get total target count across all discovery phases.
 */
export function getTotalTargetCount(): number {
  return MARATHON_PHASES.reduce(
    (sum, p) => sum + p.targets.length + (p.directNames?.length ?? 0),
    0
  );
}
