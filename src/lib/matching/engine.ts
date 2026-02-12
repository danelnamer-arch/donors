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
import { getSwipeFeedbackSignals, calculateFeedbackBoost, type SwipeFeedbackSignals } from "@/lib/matching/feedback";
import OpenAI from "openai";

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
  totalGivingUsd: number | null;
  avgGrantSizeUsd: number | null;
  donorGrantCount: number;
  dataQualityScore: number;
  vectorScore: number;
  latestGrantYear: number | null;
}

interface ScoredMatch {
  donorId: string;
  score: number;
  scoreBreakdown: {
    causeAlignment: number;
    geographicOverlap: number;
    populationOverlap: number;
    semanticSimilarity: number;
    grantSizeAlignment: number;
    recencyBonus: number;
    feedbackBoost: number;
    dataQuality: number;
  };
  reasoning: string;
}

// --- Scoring weights ---
// When user has swipe history, feedback gets 10% and dataQuality drops to 5%
const WEIGHTS = {
  semanticSimilarity: 0.25,
  causeAlignment: 0.20,
  geographicOverlap: 0.15,
  recencyBonus: 0.10,
  grantSizeAlignment: 0.10,
  populationOverlap: 0.10,
  feedbackBoost: 0.05,
  dataQuality: 0.05,
};

const WEIGHTS_WITH_FEEDBACK = {
  semanticSimilarity: 0.25,
  causeAlignment: 0.15,
  geographicOverlap: 0.15,
  recencyBonus: 0.10,
  grantSizeAlignment: 0.10,
  populationOverlap: 0.05,
  feedbackBoost: 0.10,
  dataQuality: 0.10,
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

  // Use feedback-aware weights if we have enough swipe data
  const w = feedbackSignals.hasEnoughData ? WEIGHTS_WITH_FEEDBACK : WEIGHTS;

  // Score each candidate
  const scored: ScoredMatch[] = [];
  for (const candidate of candidates) {
    const scoreBreakdown = scoreCandidate(org, candidate, orgBudget, feedbackSignals);
    const totalScore =
      scoreBreakdown.semanticSimilarity * w.semanticSimilarity +
      scoreBreakdown.causeAlignment * w.causeAlignment +
      scoreBreakdown.geographicOverlap * w.geographicOverlap +
      scoreBreakdown.recencyBonus * w.recencyBonus +
      scoreBreakdown.grantSizeAlignment * w.grantSizeAlignment +
      scoreBreakdown.populationOverlap * w.populationOverlap +
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
        match.reasoning = await generateReasoning(org, candidate, grants);
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
  d."totalGivingUsd",
  d."avgGrantSizeUsd",
  COALESCE(d."grantCount", 0) as "donorGrantCount",
  d."dataQualityScore",
  (SELECT MAX(year) FROM "DonorGrant" WHERE "donorId" = d.id) as "latestGrantYear"
`;

/**
 * Find donor candidates using cause filtering + vector similarity.
 * Three sources merged: cause-filtered, vector-similar, and fallback by quality.
 */
async function findCandidates(
  org: { id: string; causes: string[]; targetPopulations: string[]; geographicFocus: string[]; mission: string | null },
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
  org: { causes: string[]; targetPopulations: string[]; geographicFocus: string[]; annualBudgetRange: string | null },
  candidate: MatchCandidate,
  orgBudget: number | null,
  feedbackSignals: SwipeFeedbackSignals
): ScoredMatch["scoreBreakdown"] {
  const causeAlignment = fuzzyJaccardSimilarity(org.causes, candidate.donorCauses);

  // Geographic: combine geographicFocus + activeRegions
  const allDonorGeo = [...candidate.donorGeoFocus, ...candidate.donorActiveRegions];
  const geographicOverlap = fuzzyJaccardSimilarity(org.geographicFocus, allDonorGeo);

  const populationOverlap = fuzzyJaccardSimilarity(org.targetPopulations, candidate.donorPopulations);

  return {
    causeAlignment,
    geographicOverlap,
    populationOverlap,
    semanticSimilarity: candidate.vectorScore,
    grantSizeAlignment: grantSizeAlignmentScore(orgBudget, candidate.avgGrantSizeUsd),
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
 * Parse annual budget range string to a numeric midpoint.
 * e.g. "$1M-$5M" → 3000000, "Under $100K" → 50000
 */
function parseAnnualBudget(range: string | null): number | null {
  if (!range) return null;
  const lower = range.toLowerCase().replace(/,/g, "");

  // Match patterns like "$1M-$5M", "$100K-$500K"
  const rangeMatch = lower.match(/\$?([\d.]+)\s*(k|m|b)?\s*[-–to]+\s*\$?([\d.]+)\s*(k|m|b)?/);
  if (rangeMatch) {
    const low = parseAmountStr(rangeMatch[1], rangeMatch[2]);
    const high = parseAmountStr(rangeMatch[3], rangeMatch[4]);
    if (low !== null && high !== null) return (low + high) / 2;
  }

  // Match patterns like "Under $100K", "Less than $1M"
  const underMatch = lower.match(/(?:under|less than|<)\s*\$?([\d.]+)\s*(k|m|b)?/);
  if (underMatch) {
    const val = parseAmountStr(underMatch[1], underMatch[2]);
    if (val !== null) return val / 2;
  }

  // Match patterns like "Over $5M", "More than $10M"
  const overMatch = lower.match(/(?:over|more than|>)\s*\$?([\d.]+)\s*(k|m|b)?/);
  if (overMatch) {
    const val = parseAmountStr(overMatch[1], overMatch[2]);
    if (val !== null) return val * 1.5;
  }

  // Try a plain number
  const plainMatch = lower.match(/\$?([\d.]+)\s*(k|m|b)?/);
  if (plainMatch) {
    return parseAmountStr(plainMatch[1], plainMatch[2]);
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
 * Matches items using: exact match, substring containment, or Levenshtein > 80%.
 */
function fuzzyJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0 || b.length === 0) return 0;

  const itemsA = a.map((s) => s.toLowerCase().trim());
  const itemsB = b.map((s) => s.toLowerCase().trim());

  let matches = 0;
  const matchedB = new Set<number>();

  for (const itemA of itemsA) {
    for (let j = 0; j < itemsB.length; j++) {
      if (matchedB.has(j)) continue;
      if (
        itemA === itemsB[j] ||                          // Exact match
        itemA.includes(itemsB[j]) ||                     // A contains B
        itemsB[j].includes(itemA) ||                     // B contains A
        levenshteinRatio(itemA, itemsB[j]) > 0.8         // 80% similar
      ) {
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
  org: { id: string; mission: string | null; causes: string[]; geographicFocus: string[] }
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
  const embeddingText = [
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

// ==========================================
// REASONING GENERATION
// ==========================================

/**
 * Generate data-rich reasoning.
 * Tries Gemini first (with grant data), falls back to OpenAI, then to template.
 */
async function generateReasoning(
  org: { name: string; causes: string[]; targetPopulations: string[]; geographicFocus: string[]; mission: string | null },
  candidate: MatchCandidate,
  grants: { recipientName: string; amount: number | null; year: number | null }[]
): Promise<string> {
  // Try Gemini first (produces better data-rich reasoning)
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiReasoning({
        orgName: org.name,
        orgMission: org.mission,
        orgCauses: org.causes,
        orgGeoFocus: org.geographicFocus,
        donorName: candidate.donorName,
        donorType: candidate.donorType,
        donorDescription: candidate.donorDescription,
        donorCauses: candidate.donorCauses,
        donorGeoFocus: candidate.donorGeoFocus,
        donorActiveRegions: candidate.donorActiveRegions,
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
- If the donor gave to similar organizations, name them`,
        },
        {
          role: "user",
          content: `NGO "${org.name}": ${org.causes.join(", ")}. Mission: ${org.mission || "N/A"}. Geography: ${org.geographicFocus.join(", ") || "N/A"}.

Donor "${candidate.donorName}" (${candidate.donorType}): ${candidate.donorDescription || "N/A"}. Causes: ${candidate.donorCauses.join(", ") || "N/A"}. Regions: ${[...candidate.donorGeoFocus, ...candidate.donorActiveRegions].join(", ") || "N/A"}.${totalGivingStr}${candidate.donorGrantCount ? ` ${candidate.donorGrantCount} grants on record.` : ""}
${grantContext ? `Recent grants: ${grantContext}` : ""}

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
