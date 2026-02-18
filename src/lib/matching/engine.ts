/**
 * Matching Engine v3
 * Scores donors against organizations and generates data-rich reasoning.
 *
 * v3 enhancements:
 * - Real semantic similarity via pgvector (was hardcoded to 0.5)
 * - Fuzzy text matching (Jaccard + substring + Levenshtein)
 * - Grant size alignment (org budget vs donor avg grant)
 * - Recency weighting (years since last grant)
 * - Rebalanced scoring weights
 *
 * Scoring weights:
 *   1. Semantic similarity (25%) — pgvector cosine distance
 *   2. Cause alignment (20%) — fuzzy Jaccard
 *   3. Geographic overlap (15%) — fuzzy Jaccard
 *   4. Recency bonus (10%) — years since last grant
 *   5. Grant size alignment (10%) — org budget vs donor grants
 *   6. Population overlap (10%) — fuzzy Jaccard
 *   7. Data quality (10%) — profile completeness (tiebreaker)
 *
 * The score is NEVER shown to users — only the reasoning.
 */

import { prisma } from "@/lib/prisma";
import { generateMatchReasoning as geminiReasoning } from "@/lib/gemini";
import { generateEmbedding } from "@/lib/openai";
import { formatGrantAmount } from "@/lib/utils/format-amount";
import { normalizeCause } from "@/lib/utils/normalize-causes";
import { getSwipeFeedbackSignals, calculateFeedbackBoost, type SwipeFeedbackSignals } from "@/lib/matching/feedback";
import { getSimilarOrgNames, type JsonValue } from "@/lib/utils/org-helpers";
import OpenAI from "openai";

// ==========================================
// GEOGRAPHIC SYNONYMS
// ==========================================

/**
 * Geographic synonym groups — terms within a group are considered equivalent.
 * Used by fuzzyJaccardSimilarity to improve geographic matching.
 */
const GEOGRAPHIC_SYNONYM_GROUPS: string[][] = [
  ["israel", "middle east", "levant"],
  ["global", "worldwide", "international"],
  ["united states", "usa", "us", "america", "north america"],
  ["united kingdom", "uk", "britain", "england"],
  ["europe", "european union", "eu"],
];

/**
 * Check if two geographic terms are synonyms.
 */
function areGeoSynonyms(a: string, b: string): boolean {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  for (const group of GEOGRAPHIC_SYNONYM_GROUPS) {
    const aInGroup = group.some((term) => la.includes(term) || term.includes(la));
    const bInGroup = group.some((term) => lb.includes(term) || term.includes(lb));
    if (aInGroup && bInGroup) return true;
  }
  return false;
}

const openai = new OpenAI();

interface MatchCandidate {
  donorId: string;
  donorName: string;
  donorType: string;
  donorDescription: string | null;
  donorCauses: string[];
  donorPopulations: string[];
  donorGeoFocus: string[];
  donorActiveRegions: string[];
  donorCountry: string | null;
  donorWebsite: string | null;
  donorWebsiteVerified: boolean;
  donorPoliticalStance: string | null;
  totalGivingUsd: number | null;
  avgGrantSizeUsd: number | null;
  donorGrantCount: number;
  dataQualityScore: number;
  vectorScore: number;
  latestGrantYear: number | null;
  grantRecipientNames: string[];
}

interface ScoredMatch {
  donorId: string;
  score: number;
  scoreBreakdown: {
    causeAlignment: number;
    geographicOverlap: number;
    populationOverlap: number;
    semanticSimilarity: number;
    politicalAlignment: number;
    grantSizeAlignment: number;
    grantRecipientSimilarity: number;
    recencyBonus: number;
    feedbackBoost: number;
    dataQuality: number;
  };
  reasoning: string;
}

// --- Scoring weights ---
// When user has swipe history, feedback gets 10% and dataQuality drops
const WEIGHTS = {
  semanticSimilarity: 0.22,
  causeAlignment: 0.18,
  geographicOverlap: 0.13,
  politicalAlignment: 0.10,
  recencyBonus: 0.10,
  grantSizeAlignment: 0.10,
  populationOverlap: 0.07,
  grantRecipientSimilarity: 0.05,
  feedbackBoost: 0.02,
  dataQuality: 0.03,
};

const WEIGHTS_WITH_FEEDBACK = {
  semanticSimilarity: 0.22,
  causeAlignment: 0.13,
  geographicOverlap: 0.13,
  politicalAlignment: 0.10,
  recencyBonus: 0.10,
  grantSizeAlignment: 0.10,
  populationOverlap: 0.04,
  grantRecipientSimilarity: 0.05,
  feedbackBoost: 0.10,
  dataQuality: 0.03,
};

/**
 * Generate matches for an organization.
 * Finds relevant donors, scores them, and generates data-rich reasoning.
 */
export async function generateMatches(
  organizationId: string,
  options?: { limit?: number }
): Promise<ScoredMatch[]> {
  const limit = options?.limit ?? 20;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) throw new Error("Organization not found");

  // Get existing matches to exclude
  const existingDonorIds = await prisma.match
    .findMany({
      where: { organizationId },
      select: { donorId: true },
    })
    .then((m) => m.map((x) => x.donorId));

  // Get swipe feedback signals for personalization
  const feedbackSignals = await getSwipeFeedbackSignals(organizationId);

  // Also exclude donors that were swiped LEFT (from feedback)
  const allExcludeIds = [...existingDonorIds, ...feedbackSignals.rejectedDonorIds];

  // Fetch or generate org embedding for semantic search
  const orgEmbeddingStr = await getOrgEmbedding(org);

  // Parse org budget for grant-size alignment
  const orgBudget = parseAnnualBudget(org.annualBudgetRange);

  // Find candidates using cause filtering + vector similarity
  const candidates = await findCandidates(org, allExcludeIds, limit * 3, orgEmbeddingStr);

  // Fetch or generate org political embedding for ideological alignment scoring
  const orgPoliticalEmbeddingStr = await getOrgPoliticalEmbedding({
    id: org.id,
    politicalStance: org.politicalStance,
  });

  // Bulk pre-fetch political similarity for all candidates (single SQL query)
  const politicalSimilarityMap = await bulkPoliticalSimilarity(
    orgPoliticalEmbeddingStr,
    candidates.map((c) => c.donorId)
  );

  // Use feedback-aware weights if we have enough swipe data
  const w = feedbackSignals.hasEnoughData ? WEIGHTS_WITH_FEEDBACK : WEIGHTS;

  // Score each candidate
  const scored: ScoredMatch[] = [];
  for (const candidate of candidates) {
    const scoreBreakdown = scoreCandidate(org, candidate, orgBudget, feedbackSignals, politicalSimilarityMap);
    const totalScore =
      scoreBreakdown.semanticSimilarity * w.semanticSimilarity +
      scoreBreakdown.causeAlignment * w.causeAlignment +
      scoreBreakdown.geographicOverlap * w.geographicOverlap +
      scoreBreakdown.politicalAlignment * w.politicalAlignment +
      scoreBreakdown.recencyBonus * w.recencyBonus +
      scoreBreakdown.grantSizeAlignment * w.grantSizeAlignment +
      scoreBreakdown.populationOverlap * w.populationOverlap +
      scoreBreakdown.grantRecipientSimilarity * w.grantRecipientSimilarity +
      scoreBreakdown.feedbackBoost * w.feedbackBoost +
      scoreBreakdown.dataQuality * w.dataQuality;

    scored.push({
      donorId: candidate.donorId,
      score: Math.round(totalScore * 100) / 100,
      scoreBreakdown,
      reasoning: "",
    });
  }

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, limit);

  // Fetch top grants for each top match (for reasoning)
  const candidateMap = new Map(candidates.map((c) => [c.donorId, c]));

  const donorGrants = await prisma.donorGrant.findMany({
    where: { donorId: { in: topMatches.map((m) => m.donorId) } },
    orderBy: { amount: "desc" },
  });

  const grantsByDonor = new Map<string, typeof donorGrants>();
  for (const g of donorGrants) {
    const existing = grantsByDonor.get(g.donorId) || [];
    existing.push(g);
    grantsByDonor.set(g.donorId, existing);
  }

  // Generate reasoning in parallel
  await Promise.all(
    topMatches.map(async (match) => {
      const candidate = candidateMap.get(match.donorId);
      const grants = grantsByDonor.get(match.donorId) || [];
      if (candidate) {
        match.reasoning = await generateReasoning(org, candidate, grants, match.scoreBreakdown);
      }
    })
  );

  return topMatches;
}

// ==========================================
// CANDIDATE FINDING
// ==========================================

/**
 * Common SELECT fields for donor candidate queries.
 */
const CANDIDATE_SELECT = `
  d.id as "donorId",
  d.name as "donorName",
  d.type as "donorType",
  d.description as "donorDescription",
  d.causes as "donorCauses",
  d."targetPopulations" as "donorPopulations",
  d."geographicFocus" as "donorGeoFocus",
  COALESCE(d."activeRegions", '{}') as "donorActiveRegions",
  d.country as "donorCountry",
  d.website as "donorWebsite",
  COALESCE(d."websiteVerified", false) as "donorWebsiteVerified",
  d."politicalStance" as "donorPoliticalStance",
  d."totalGivingUsd",
  d."avgGrantSizeUsd",
  COALESCE(d."grantCount", 0) as "donorGrantCount",
  d."dataQualityScore",
  (SELECT MAX(year) FROM "DonorGrant" WHERE "donorId" = d.id) as "latestGrantYear",
  COALESCE((SELECT array_agg(DISTINCT sub."recipientName") FROM (SELECT "recipientName" FROM "DonorGrant" WHERE "donorId" = d.id AND "recipientName" IS NOT NULL LIMIT 50) sub), '{}') as "grantRecipientNames"
`;

/**
 * Find donor candidates using cause filtering + vector similarity.
 * Three sources merged: cause-filtered, vector-similar, and fallback by quality.
 */
async function findCandidates(
  org: { id: string; causes: string[]; targetAudience: string | null; geographicFocus: string[]; mission: string | null },
  excludeIds: string[],
  limit: number,
  orgEmbeddingStr: string | null
): Promise<MatchCandidate[]> {
  const resultMap = new Map<string, MatchCandidate>();

  // Source 1: Cause-filtered candidates
  const causeResults = await findCauseFilteredCandidates(org.causes, excludeIds, limit);
  for (const r of causeResults) {
    resultMap.set(r.donorId, { ...r, vectorScore: 0.5 }); // default vector score
  }

  // Source 2: Vector-similar candidates (if org has embedding)
  if (orgEmbeddingStr) {
    const allExcludeIds = [...excludeIds, ...Array.from(resultMap.keys())];
    const vectorResults = await findVectorSimilarCandidates(orgEmbeddingStr, allExcludeIds, Math.ceil(limit / 2));
    for (const r of vectorResults) {
      if (!resultMap.has(r.donorId)) {
        resultMap.set(r.donorId, r);
      } else {
        // Update vector score for candidates found by both methods
        const existing = resultMap.get(r.donorId)!;
        existing.vectorScore = r.vectorScore;
      }
    }
  }

  // Source 3: Fallback — fill remaining slots with high-quality donors
  if (resultMap.size < limit) {
    const allExcludeIds = [...excludeIds, ...Array.from(resultMap.keys())];
    const fallbackResults = await findFallbackCandidates(allExcludeIds, limit - resultMap.size);
    for (const r of fallbackResults) {
      if (!resultMap.has(r.donorId)) {
        resultMap.set(r.donorId, { ...r, vectorScore: 0.3 }); // lower default for fallback
      }
    }
  }

  return Array.from(resultMap.values());
}

/**
 * Find candidates that share causes with the org.
 */
async function findCauseFilteredCandidates(
  causes: string[],
  excludeIds: string[],
  limit: number
): Promise<(Omit<MatchCandidate, "vectorScore"> & { vectorScore: number })[]> {
  const causeFilter =
    causes.length > 0
      ? `AND d."causes" && ARRAY[${causes.map((_, i) => `$${i + 1}`).join(",")}]::text[]`
      : "";

  const causeValues = causes.length > 0 ? causes : [];
  const paramOffset = causeValues.length;

  const excludeFilter =
    excludeIds.length > 0
      ? `AND d.id != ALL($${paramOffset + 1}::text[])`
      : "";

  const allValues = [
    ...causeValues,
    ...(excludeIds.length > 0 ? [excludeIds] : []),
    limit,
  ];

  const sql = `
    SELECT ${CANDIDATE_SELECT}, 0.5::float as "vectorScore"
    FROM "Donor" d
    WHERE 1=1
    ${causeFilter}
    ${excludeFilter}
    ORDER BY d."dataQualityScore" DESC
    LIMIT $${allValues.length}
  `;

  return prisma.$queryRawUnsafe<MatchCandidate[]>(sql, ...allValues);
}

/**
 * Find candidates via pgvector semantic similarity.
 */
async function findVectorSimilarCandidates(
  embeddingStr: string,
  excludeIds: string[],
  limit: number
): Promise<MatchCandidate[]> {
  const excludeFilter = excludeIds.length > 0 ? `AND d.id != ALL($2::text[])` : "";
  const values: unknown[] = excludeIds.length > 0
    ? [embeddingStr, excludeIds, limit]
    : [embeddingStr, limit];
  const limitParam = excludeIds.length > 0 ? "$3" : "$2";

  const sql = `
    SELECT ${CANDIDATE_SELECT},
      1 - (d."missionEmbedding" <=> $1::vector) as "vectorScore"
    FROM "Donor" d
    WHERE d."missionEmbedding" IS NOT NULL
    ${excludeFilter}
    ORDER BY d."missionEmbedding" <=> $1::vector ASC
    LIMIT ${limitParam}
  `;

  return prisma.$queryRawUnsafe<MatchCandidate[]>(sql, ...values);
}

/**
 * Fallback: fetch donors by data quality when other sources are exhausted.
 */
async function findFallbackCandidates(
  excludeIds: string[],
  limit: number
): Promise<(Omit<MatchCandidate, "vectorScore"> & { vectorScore: number })[]> {
  const excludeFilter = excludeIds.length > 0 ? `AND d.id != ALL($1::text[])` : "";
  const values: unknown[] = excludeIds.length > 0 ? [excludeIds, limit] : [limit];
  const limitParam = excludeIds.length > 0 ? "$2" : "$1";

  const sql = `
    SELECT ${CANDIDATE_SELECT}, 0.3::float as "vectorScore"
    FROM "Donor" d
    WHERE 1=1
    ${excludeFilter}
    ORDER BY d."dataQualityScore" DESC
    LIMIT ${limitParam}
  `;

  return prisma.$queryRawUnsafe<MatchCandidate[]>(sql, ...values);
}

// ==========================================
// SCORING
// ==========================================

/**
 * Score a candidate against the organization.
 * Uses fuzzy matching, vector similarity, grant-size alignment, and recency.
 */
function scoreCandidate(
  org: { causes: string[]; targetAudience: string | null; geographicFocus: string[]; annualBudgetRange: string | null; similarOrgs: JsonValue[] },
  candidate: MatchCandidate,
  orgBudget: number | null,
  feedbackSignals: SwipeFeedbackSignals,
  politicalSimilarityMap: Map<string, number> = new Map()
): ScoredMatch["scoreBreakdown"] {
  // Cause alignment with canonical synonym matching
  const causeAlignment = fuzzyJaccardSimilarity(org.causes, candidate.donorCauses, "cause");

  // Geographic: combine geographicFocus + activeRegions, use geo synonym matching
  const allDonorGeo = [...candidate.donorGeoFocus, ...candidate.donorActiveRegions];
  let geographicOverlap = fuzzyJaccardSimilarity(org.geographicFocus, allDonorGeo, "geo");

  // Israel boost: if org targets Israel and donor has any Israel/Middle East/Global connection,
  // ensure a minimum floor so Israeli-focused donors aren't penalized by sparse geo data
  const orgTargetsIsrael = org.geographicFocus.some((g) => /israel/i.test(g));
  if (orgTargetsIsrael && geographicOverlap < 0.3) {
    const donorGeoStr = allDonorGeo.join(" ").toLowerCase();
    const donorDescStr = (candidate.donorDescription || "").toLowerCase();
    const hasIsraelConnection =
      /israel|middle east|jerusalem|tel.?aviv|negev|galilee|jewish|zion/i.test(donorGeoStr) ||
      /israel|middle east|jerusalem|jewish|zion/i.test(donorDescStr);
    if (hasIsraelConnection) {
      geographicOverlap = Math.max(geographicOverlap, 0.3);
    }
  }

  // targetAudience is now a single text string; split by common delimiters for fuzzy matching
  const orgPopulations = org.targetAudience
    ? org.targetAudience.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const populationOverlap = fuzzyJaccardSimilarity(orgPopulations, candidate.donorPopulations);

  // Grant recipient similarity: does this donor fund orgs similar to ours?
  const grantRecipientSimilarity = grantRecipientSimilarityScore(
    getSimilarOrgNames(org.similarOrgs),
    candidate.grantRecipientNames
  );

  // Political alignment: use pre-fetched similarity, default to 0.5 (neutral) if missing
  const politicalAlignment = candidate.donorPoliticalStance
    ? (politicalSimilarityMap.get(candidate.donorId) ?? 0.5)
    : 0.5;

  return {
    causeAlignment,
    geographicOverlap,
    populationOverlap,
    semanticSimilarity: candidate.vectorScore,
    politicalAlignment,
    grantSizeAlignment: grantSizeAlignmentScore(orgBudget, candidate.avgGrantSizeUsd),
    grantRecipientSimilarity,
    recencyBonus: recencyScore(candidate.latestGrantYear),
    feedbackBoost: calculateFeedbackBoost(candidate, feedbackSignals),
    dataQuality: candidate.dataQualityScore,
  };
}

/**
 * Grant size alignment: how well the donor's typical grant fits the org's budget.
 * Sweet spot: org budget is 2-20x the average grant size.
 */
function grantSizeAlignmentScore(orgBudget: number | null, donorAvgGrant: number | null): number {
  if (!orgBudget || !donorAvgGrant || donorAvgGrant <= 0) return 0.5; // Unknown, neutral
  const ratio = orgBudget / donorAvgGrant;
  if (ratio >= 2 && ratio <= 20) return 1.0;    // Sweet spot
  if (ratio >= 1 && ratio < 2) return 0.8;       // Grant is very large relative to budget
  if (ratio > 20 && ratio <= 100) return 0.7;    // Grant is small but useful
  if (ratio > 100) return 0.3;                    // Grant is trivially small
  if (ratio < 1) return 0.4;                      // Grant exceeds entire budget
  return 0.5;
}

/**
 * Recency score: how recently the donor made grants.
 */
function recencyScore(latestGrantYear: number | null): number {
  if (!latestGrantYear) return 0.3; // Unknown, slight penalty
  const age = new Date().getFullYear() - latestGrantYear;
  if (age <= 1) return 1.0;    // Gave within last year
  if (age <= 3) return 0.8;    // Gave within 3 years
  if (age <= 5) return 0.5;    // Gave within 5 years
  return 0.2;                   // Stale donor
}

/**
 * Grant recipient similarity: does this donor fund organizations similar to ours?
 * Compares donor's grant recipients against org.similarOrgs using fuzzy matching.
 * Even a single match is a strong signal — this is the "social proof" factor.
 */
function grantRecipientSimilarityScore(similarOrgNames: string[], grantRecipients: string[]): number {
  if (!similarOrgNames.length || !grantRecipients.length) return 0;

  // Check if any grant recipient fuzzy-matches a similar org name
  const similarLower = similarOrgNames.map((s) => s.toLowerCase().trim());
  const recipientLower = grantRecipients.map((r) => r.toLowerCase().trim());

  let matchCount = 0;
  for (const similar of similarLower) {
    for (const recipient of recipientLower) {
      if (
        similar === recipient ||
        recipient.includes(similar) ||
        similar.includes(recipient) ||
        levenshteinRatio(similar, recipient) > 0.75
      ) {
        matchCount++;
        break; // Count each similar org at most once
      }
    }
  }

  if (matchCount === 0) return 0;
  // Even 1 match is very strong; scale: 1 match = 0.7, 2 = 0.85, 3+ = 1.0
  if (matchCount === 1) return 0.7;
  if (matchCount === 2) return 0.85;
  return 1.0;
}

/**
 * Parse annual budget range string to a numeric midpoint.
 * e.g. "$1M-$5M" → 3000000, "Under $100K" → 50000
 */
function parseAnnualBudget(range: string | null): number | null {
  if (!range) return null;
  const lower = range.toLowerCase().replace(/,/g, "");

  // Detect Israeli Shekel amounts (₪, NIS, ILS) and convert to USD
  // Approximate rate: 1 USD ≈ 3.6 ILS
  const ILS_TO_USD = 1 / 3.6;
  const isILS = /[₪]|nis|ils/.test(lower);
  const conversionFactor = isILS ? ILS_TO_USD : 1;

  // Strip shekel symbol for parsing
  const cleaned = lower.replace(/[₪]/g, "").trim();

  // Match patterns like "$1M-$5M", "$100K-$500K"
  const rangeMatch = cleaned.match(/\$?([\d.]+)\s*(k|m|b)?\s*[-–to]+\s*\$?([\d.]+)\s*(k|m|b)?/);
  if (rangeMatch) {
    const low = parseAmountStr(rangeMatch[1], rangeMatch[2]);
    const high = parseAmountStr(rangeMatch[3], rangeMatch[4]);
    if (low !== null && high !== null) return ((low + high) / 2) * conversionFactor;
  }

  // Match patterns like "Under $100K", "Less than $1M"
  const underMatch = cleaned.match(/(?:under|less than|<)\s*\$?([\d.]+)\s*(k|m|b)?/);
  if (underMatch) {
    const val = parseAmountStr(underMatch[1], underMatch[2]);
    if (val !== null) return (val / 2) * conversionFactor;
  }

  // Match patterns like "Over $5M", "More than $10M"
  const overMatch = cleaned.match(/(?:over|more than|>)\s*\$?([\d.]+)\s*(k|m|b)?/);
  if (overMatch) {
    const val = parseAmountStr(overMatch[1], overMatch[2]);
    if (val !== null) return val * 1.5 * conversionFactor;
  }

  // Try a plain number
  const plainMatch = cleaned.match(/\$?([\d.]+)\s*(k|m|b)?/);
  if (plainMatch) {
    const val = parseAmountStr(plainMatch[1], plainMatch[2]);
    if (val !== null) return val * conversionFactor;
  }

  return null;
}

function parseAmountStr(numStr: string, suffix?: string): number | null {
  const num = parseFloat(numStr);
  if (isNaN(num)) return null;
  switch (suffix?.toLowerCase()) {
    case "b": return num * 1_000_000_000;
    case "m": return num * 1_000_000;
    case "k": return num * 1_000;
    default: return num;
  }
}

// ==========================================
// FUZZY TEXT MATCHING
// ==========================================

/**
 * Fuzzy Jaccard similarity.
 * Matches items using: canonical cause synonym, exact match, substring, or Levenshtein > 80%.
 *
 * When `mode` is "geo", geographic synonym groups are used instead of cause normalization.
 */
function fuzzyJaccardSimilarity(a: string[], b: string[], mode: "cause" | "geo" | "default" = "default"): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0 || b.length === 0) return 0;

  const itemsA = a.map((s) => s.toLowerCase().trim());
  const itemsB = b.map((s) => s.toLowerCase().trim());

  let matches = 0;
  const matchedB = new Set<number>();

  for (let i = 0; i < itemsA.length; i++) {
    const itemA = itemsA[i];
    for (let j = 0; j < itemsB.length; j++) {
      if (matchedB.has(j)) continue;

      let isMatch = false;

      // 1. Exact match
      if (itemA === itemsB[j]) {
        isMatch = true;
      }
      // 2. Canonical cause synonym (e.g. "Children" ↔ "Youth Development")
      else if (mode === "cause" && normalizeCause(a[i]) === normalizeCause(b[j])) {
        isMatch = true;
      }
      // 2b. Geographic synonym (e.g. "Israel" ↔ "Middle East")
      else if (mode === "geo" && areGeoSynonyms(a[i], b[j])) {
        isMatch = true;
      }
      // 3. Substring containment
      else if (itemA.includes(itemsB[j]) || itemsB[j].includes(itemA)) {
        isMatch = true;
      }
      // 4. Levenshtein > 80% similar
      else if (levenshteinRatio(itemA, itemsB[j]) > 0.8) {
        isMatch = true;
      }

      if (isMatch) {
        matches++;
        matchedB.add(j);
        break;
      }
    }
  }

  const union = itemsA.length + itemsB.length - matches;
  return union > 0 ? matches / union : 0;
}

/**
 * Levenshtein distance ratio (0-1, where 1 = identical).
 */
function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = i === 0 ? j : 0;
    }
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - matrix[a.length][b.length] / maxLen;
}

// ==========================================
// EMBEDDING HELPERS
// ==========================================

/**
 * Get the org's embedding, generating and storing it if missing.
 */
async function getOrgEmbedding(
  org: { id: string; mission: string | null; causes: string[]; geographicFocus: string[]; rawProfileText?: string | null }
): Promise<string | null> {
  // Check for existing embedding
  const existing = await prisma.$queryRawUnsafe<{ emb: string }[]>(
    `SELECT "missionEmbedding"::text as emb FROM "Organization" WHERE id = $1 AND "missionEmbedding" IS NOT NULL`,
    org.id
  );

  if (existing.length > 0 && existing[0].emb) {
    return existing[0].emb;
  }

  // Generate embedding from org profile
  // When rawProfileText is available, use it for a much richer embedding
  // that captures programs, operational language, and nuanced details
  const embeddingText = org.rawProfileText
    ? org.rawProfileText.slice(0, 8000)
    : [
        org.mission,
        org.causes.length ? `Causes: ${org.causes.join(", ")}` : null,
        org.geographicFocus.length ? `Geographic focus: ${org.geographicFocus.join(", ")}` : null,
      ].filter(Boolean).join(". ");

  if (!embeddingText) return null;

  try {
    const embedding = await generateEmbedding(embeddingText);
    const embStr = JSON.stringify(embedding);

    // Store for future use
    await prisma.$executeRawUnsafe(
      `UPDATE "Organization" SET "missionEmbedding" = $1::vector WHERE id = $2`,
      embStr,
      org.id
    );

    return embStr;
  } catch (err) {
    console.error("[matching] Failed to generate org embedding:", err);
    return null;
  }
}

/**
 * Get the org's political embedding, generating and storing it if missing.
 */
async function getOrgPoliticalEmbedding(
  org: { id: string; politicalStance: string | null }
): Promise<string | null> {
  // Check for existing embedding
  const existing = await prisma.$queryRawUnsafe<{ emb: string }[]>(
    `SELECT "politicalEmbedding"::text as emb FROM "Organization" WHERE id = $1 AND "politicalEmbedding" IS NOT NULL`,
    org.id
  );

  if (existing.length > 0 && existing[0].emb) {
    return existing[0].emb;
  }

  if (!org.politicalStance) return null;

  try {
    const embedding = await generateEmbedding(org.politicalStance);
    const embStr = JSON.stringify(embedding);

    await prisma.$executeRawUnsafe(
      `UPDATE "Organization" SET "politicalEmbedding" = $1::vector WHERE id = $2`,
      embStr,
      org.id
    );

    return embStr;
  } catch (err) {
    console.error("[matching] Failed to generate org political embedding:", err);
    return null;
  }
}

/**
 * Bulk pre-fetch political alignment scores for a set of candidates.
 * Returns a Map of donorId → cosine similarity score.
 * Donors without political embeddings are not included (they'll default to 0.5 neutral).
 */
async function bulkPoliticalSimilarity(
  orgPoliticalEmbeddingStr: string | null,
  candidateIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!orgPoliticalEmbeddingStr || candidateIds.length === 0) return result;

  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string; sim: number }[]>(
      `SELECT id, 1 - ("politicalEmbedding" <=> $1::vector) as sim
       FROM "Donor"
       WHERE id = ANY($2::text[]) AND "politicalEmbedding" IS NOT NULL`,
      orgPoliticalEmbeddingStr,
      candidateIds
    );

    for (const row of rows) {
      // Map cosine similarity to a score:
      // High (>=0.8) → 1.0, Moderate (0.5-0.8) → 0.8-1.0, Low (<0.5) → 0.2-0.5
      const sim = row.sim;
      let score: number;
      if (sim >= 0.8) score = 1.0;
      else if (sim >= 0.5) score = Math.min(1.0, 0.3 + sim);
      else score = Math.max(0.2, sim);
      result.set(row.id, score);
    }
  } catch (err) {
    console.error("[matching] Failed to bulk fetch political similarity:", err);
  }

  return result;
}

// ==========================================
// REASONING GENERATION
// ==========================================

/**
 * Generate data-rich reasoning.
 * Tries Gemini first (with grant data), falls back to OpenAI, then to template.
 */
async function generateReasoning(
  org: { name: string; causes: string[]; targetAudience: string | null; geographicFocus: string[]; mission: string | null; rawProfileText?: string | null; politicalStance?: string | null },
  candidate: MatchCandidate,
  grants: { recipientName: string; amount: number | null; year: number | null }[],
  scoreBreakdown?: ScoredMatch["scoreBreakdown"]
): Promise<string> {
  // Try Gemini first (produces better data-rich reasoning)
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiReasoning({
        orgName: org.name,
        orgMission: org.mission,
        orgCauses: org.causes,
        orgGeoFocus: org.geographicFocus,
        orgRawProfileText: org.rawProfileText,
        orgPoliticalStance: org.politicalStance,
        donorName: candidate.donorName,
        donorType: candidate.donorType,
        donorDescription: candidate.donorDescription,
        donorCauses: candidate.donorCauses,
        donorGeoFocus: candidate.donorGeoFocus,
        donorActiveRegions: candidate.donorActiveRegions,
        donorPoliticalStance: candidate.donorPoliticalStance,
        topGrants: grants.slice(0, 5),
        totalGiving: candidate.totalGivingUsd,
        grantCount: candidate.donorGrantCount,
      });
    } catch (err) {
      console.error("[matching] Gemini reasoning failed, falling back to OpenAI:", err);
    }
  }

  // Fallback: OpenAI with enriched prompt
  try {
    const grantContext = grants.slice(0, 5).map((g) => {
      const parts = [g.recipientName];
      if (g.amount) parts.push(formatGrantAmount(g.amount));
      if (g.year) parts.push(`(${g.year})`);
      return parts.join(" — ");
    }).join("; ");

    const totalGivingStr = candidate.totalGivingUsd
      ? ` Total giving: ~${formatGrantAmount(candidate.totalGivingUsd)}.`
      : "";

    // Build score context for the prompt
    const strongSignals: string[] = [];
    if (scoreBreakdown) {
      if (scoreBreakdown.causeAlignment >= 0.6) strongSignals.push("strong cause alignment");
      if (scoreBreakdown.geographicOverlap >= 0.5) strongSignals.push("strong geographic overlap");
      if (scoreBreakdown.grantSizeAlignment >= 0.8) strongSignals.push("good grant size fit");
      if (scoreBreakdown.semanticSimilarity >= 0.7) strongSignals.push("high mission similarity");
      if (scoreBreakdown.populationOverlap >= 0.5) strongSignals.push("overlapping target populations");
      if (scoreBreakdown.politicalAlignment >= 0.7) strongSignals.push("shared ideological values");
    }
    const signalHint = strongSignals.length > 0
      ? `\nStrongest match signals: ${strongSignals.join(", ")}. Focus your reasoning on these areas.`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You write concise match explanations for an NGO donor matching platform.
RULES:
- Write 2-3 sentences
- Be SPECIFIC: mention grant recipients by name, dollar amounts, regions
- Never say generic things like "aligns with your mission" without concrete evidence
- Never mention scores, percentages, or algorithms
- If the donor gave to similar organizations, name them

ISRAEL-SPECIFIC RULES (apply when relevant):
- Many nonprofits in this platform operate in Israel. If the NGO operates in Israel, highlight the donor's Israel connections.
- Look for signals: grants to Israeli organizations, "Jewish" or "Israel" in donor description, Middle East geographic focus.
- Distinguish between Israel-focused donors (e.g., Jewish federations, Israel-specific funds) and general international donors who also give to Israel.
- If the donor has funded organizations in Israel, mention those recipients specifically.
- "Jewish community" donors often fund Israeli causes — note this connection when relevant.
- If a detailed org profile is provided, reference their specific programs and activities in your reasoning rather than just restating cause labels.`,
        },
        {
          role: "user",
          content: `NGO "${org.name}": ${org.causes.join(", ")}. Mission: ${org.mission || "N/A"}. Geography: ${org.geographicFocus.join(", ") || "N/A"}.${org.rawProfileText ? `\n\nDetailed org profile:\n${org.rawProfileText.slice(0, 2000)}` : ""}

Donor "${candidate.donorName}" (${candidate.donorType}): ${candidate.donorDescription || "N/A"}. Causes: ${candidate.donorCauses.join(", ") || "N/A"}. Regions: ${[...candidate.donorGeoFocus, ...candidate.donorActiveRegions].join(", ") || "N/A"}.${totalGivingStr}${candidate.donorGrantCount ? ` ${candidate.donorGrantCount} grants on record.` : ""}
${grantContext ? `Recent grants: ${grantContext}` : ""}${signalHint}

Explain why this donor is a good match.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content?.trim() ?? buildFallbackReasoning(org, candidate, grants);
  } catch {
    return buildFallbackReasoning(org, candidate, grants);
  }
}

/**
 * Template-based fallback when all AI providers are unavailable.
 */
function buildFallbackReasoning(
  org: { causes: string[] },
  candidate: MatchCandidate,
  grants: { recipientName: string; amount: number | null; year: number | null }[]
): string {
  const parts: string[] = [];

  // Shared causes
  const sharedCauses = org.causes.filter((c) =>
    candidate.donorCauses.some((dc) => dc.toLowerCase() === c.toLowerCase())
  );
  if (sharedCauses.length > 0) {
    parts.push(`${candidate.donorName} actively funds ${sharedCauses.join(", ")}`);
  }

  // Grant data
  if (grants.length > 0) {
    const topGrant = grants[0];
    const grantStr = topGrant.amount
      ? `including a ${formatGrantAmount(topGrant.amount)} grant to ${topGrant.recipientName}`
      : `including grants to ${topGrant.recipientName}`;
    parts.push(grantStr);
  }

  // Total giving
  if (candidate.totalGivingUsd && candidate.totalGivingUsd > 0) {
    parts.push(`with ~${formatGrantAmount(candidate.totalGivingUsd)} in total giving`);
  }

  if (parts.length > 0) {
    return parts.join(", ") + ".";
  }

  return `${candidate.donorName} is a ${candidate.donorType.toLowerCase()} that supports causes relevant to your organization.`;
}

// ==========================================
// DATABASE OPERATIONS
// ==========================================

/**
 * Store generated matches in the database.
 */
export async function storeMatches(organizationId: string, matches: ScoredMatch[]) {
  const data = matches.map((m) => ({
    organizationId,
    donorId: m.donorId,
    score: m.score,
    scoreBreakdown: m.scoreBreakdown as Record<string, number>,
    reasoning: m.reasoning,
    status: "PENDING" as const,
  }));

  await prisma.match.createMany({ data, skipDuplicates: true });
}

/**
 * Get the next batch of matches for swiping.
 */
export async function getNextMatches(organizationId: string, limit: number = 10) {
  return prisma.match.findMany({
    where: { organizationId, status: "PENDING" },
    include: {
      donor: {
        include: {
          grants: { take: 5, orderBy: { amount: "desc" } },
          publications: { take: 3, orderBy: { publishedAt: "desc" } },
        },
      },
    },
    orderBy: { score: "desc" },
    take: limit,
  });
}
