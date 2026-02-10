/**
 * Matching Engine
 * Scores donors against organizations and generates human-readable reasoning.
 *
 * Scoring weights (from highest to lowest priority):
 *   1. Similar orgs' donors (40%)
 *   2. Cause alignment (25%)
 *   3. Geographic overlap (15%)
 *   4. Target population overlap (10%)
 *   5. Semantic similarity (10%)
 *
 * The score is NEVER shown to users — only the reasoning.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";
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
  donorCountry: string | null;
  donorWebsite: string | null;
  dataQualityScore: number;
}

interface ScoredMatch {
  donorId: string;
  score: number;
  scoreBreakdown: {
    causeAlignment: number;
    geographicOverlap: number;
    populationOverlap: number;
    semanticSimilarity: number;
    dataQuality: number;
  };
  reasoning: string;
}

/**
 * Generate matches for an organization.
 * Finds relevant donors, scores them, and generates reasoning.
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

  // Get existing matches and swiped donors to exclude
  const existingDonorIds = await prisma.match
    .findMany({
      where: { organizationId },
      select: { donorId: true },
    })
    .then((m) => m.map((x) => x.donorId));

  // Find candidates using multiple strategies
  const candidates = await findCandidates(org, existingDonorIds, limit * 3);

  // Score each candidate
  const scored: ScoredMatch[] = [];

  for (const candidate of candidates) {
    const scoreBreakdown = scoreCandidate(org, candidate);
    const totalScore =
      scoreBreakdown.causeAlignment * 0.30 +
      scoreBreakdown.geographicOverlap * 0.20 +
      scoreBreakdown.populationOverlap * 0.15 +
      scoreBreakdown.semanticSimilarity * 0.15 +
      scoreBreakdown.dataQuality * 0.20;

    scored.push({
      donorId: candidate.donorId,
      score: Math.round(totalScore * 100) / 100,
      scoreBreakdown,
      reasoning: "", // Generated below
    });
  }

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, limit);

  // Generate reasoning for top matches (batch for efficiency)
  const candidateMap = new Map(
    candidates.map((c) => [c.donorId, c])
  );

  await Promise.all(
    topMatches.map(async (match) => {
      const candidate = candidateMap.get(match.donorId);
      if (candidate) {
        match.reasoning = await generateReasoning(org, candidate, match.scoreBreakdown);
      }
    })
  );

  return topMatches;
}

/**
 * Find donor candidates using multiple strategies.
 */
async function findCandidates(
  org: { id: string; causes: string[]; targetPopulations: string[]; geographicFocus: string[]; mission: string | null },
  excludeIds: string[],
  limit: number
): Promise<MatchCandidate[]> {
  // Strategy 1: Cause-aligned donors (full-text filter)
  const causeFilter =
    org.causes.length > 0
      ? `AND d."causes" && ARRAY[${org.causes.map((_, i) => `$${i + 1}`).join(",")}]::text[]`
      : "";

  const causeValues = org.causes.length > 0 ? org.causes : [];

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
    SELECT
      d.id as "donorId",
      d.name as "donorName",
      d.type as "donorType",
      d.description as "donorDescription",
      d.causes as "donorCauses",
      d."targetPopulations" as "donorPopulations",
      d."geographicFocus" as "donorGeoFocus",
      d.country as "donorCountry",
      d.website as "donorWebsite",
      d."dataQualityScore"
    FROM "Donor" d
    WHERE 1=1
    ${causeFilter}
    ${excludeFilter}
    ORDER BY d."dataQualityScore" DESC
    LIMIT $${allValues.length}
  `;

  const results = await prisma.$queryRawUnsafe<MatchCandidate[]>(
    sql,
    ...allValues
  );

  // Strategy 2: If we don't have enough from cause filtering, get more
  if (results.length < limit) {
    const existingIds = [...excludeIds, ...results.map((r) => r.donorId)];
    const moreValues = existingIds.length > 0 ? [existingIds, limit - results.length] : [limit - results.length];
    const moreExclude = existingIds.length > 0 ? `AND d.id != ALL($1::text[])` : "";
    const limitParam = existingIds.length > 0 ? "$2" : "$1";

    const moreSql = `
      SELECT
        d.id as "donorId",
        d.name as "donorName",
        d.type as "donorType",
        d.description as "donorDescription",
        d.causes as "donorCauses",
        d."targetPopulations" as "donorPopulations",
        d."geographicFocus" as "donorGeoFocus",
        d.country as "donorCountry",
        d.website as "donorWebsite",
        d."dataQualityScore"
      FROM "Donor" d
      WHERE 1=1
      ${moreExclude}
      ORDER BY d."dataQualityScore" DESC
      LIMIT ${limitParam}
    `;

    const moreResults = await prisma.$queryRawUnsafe<MatchCandidate[]>(
      moreSql,
      ...moreValues
    );
    results.push(...moreResults);
  }

  return results;
}

/**
 * Score a single candidate against the organization.
 */
function scoreCandidate(
  org: { causes: string[]; targetPopulations: string[]; geographicFocus: string[] },
  candidate: MatchCandidate
): ScoredMatch["scoreBreakdown"] {
  // Cause alignment: Jaccard similarity
  const causeOverlap = intersectionSize(org.causes, candidate.donorCauses);
  const causeUnion = unionSize(org.causes, candidate.donorCauses);
  const causeAlignment = causeUnion > 0 ? causeOverlap / causeUnion : 0;

  // Geographic overlap
  const geoOverlap = intersectionSize(org.geographicFocus, candidate.donorGeoFocus);
  const geoUnion = unionSize(org.geographicFocus, candidate.donorGeoFocus);
  const geographicOverlap = geoUnion > 0 ? geoOverlap / geoUnion : 0;

  // Population overlap
  const popOverlap = intersectionSize(org.targetPopulations, candidate.donorPopulations);
  const popUnion = unionSize(org.targetPopulations, candidate.donorPopulations);
  const populationOverlap = popUnion > 0 ? popOverlap / popUnion : 0;

  return {
    causeAlignment,
    geographicOverlap,
    populationOverlap,
    semanticSimilarity: 0.5, // Default; upgraded when embeddings are available
    dataQuality: candidate.dataQualityScore,
  };
}

/**
 * Generate human-readable reasoning for why a donor is a good match.
 * This is what the user sees instead of a score.
 */
async function generateReasoning(
  org: { name: string; causes: string[]; targetPopulations: string[]; geographicFocus: string[]; mission: string | null },
  candidate: MatchCandidate,
  breakdown: ScoredMatch["scoreBreakdown"]
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write concise, helpful explanations of why a donor might be a good match for an NGO. Write 2-3 sentences. Be specific about the alignment. Never mention scores or numbers.",
        },
        {
          role: "user",
          content: `NGO "${org.name}" focuses on: ${org.causes.join(", ")}. Mission: ${org.mission || "N/A"}. Populations: ${org.targetPopulations.join(", ") || "N/A"}. Geography: ${org.geographicFocus.join(", ") || "N/A"}.

Donor "${candidate.donorName}" (${candidate.donorType}) focuses on: ${candidate.donorCauses.join(", ") || "general philanthropy"}. Description: ${candidate.donorDescription || "N/A"}. Geography: ${candidate.donorGeoFocus.join(", ") || "N/A"}.

Explain why this donor could be a good match for this NGO.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return (
      response.choices[0]?.message?.content?.trim() ??
      "This donor's focus areas align with your organization's mission."
    );
  } catch {
    // Fallback reasoning when OpenAI is unavailable
    const sharedCauses = org.causes.filter((c) =>
      candidate.donorCauses.some(
        (dc) => dc.toLowerCase() === c.toLowerCase()
      )
    );

    if (sharedCauses.length > 0) {
      return `${candidate.donorName} has supported causes including ${sharedCauses.join(", ")}, which align with your organization's focus areas.`;
    }

    return `${candidate.donorName} is a ${candidate.donorType.toLowerCase()} that may be relevant to your organization's work.`;
  }
}

/** Set intersection size (case-insensitive). */
function intersectionSize(a: string[], b: string[]): number {
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((x) => setB.has(x.toLowerCase())).length;
}

/** Set union size (case-insensitive). */
function unionSize(a: string[], b: string[]): number {
  const all = new Set([
    ...a.map((s) => s.toLowerCase()),
    ...b.map((s) => s.toLowerCase()),
  ]);
  return all.size;
}

/**
 * Store generated matches in the database.
 */
export async function storeMatches(
  organizationId: string,
  matches: ScoredMatch[]
) {
  const data = matches.map((m) => ({
    organizationId,
    donorId: m.donorId,
    score: m.score,
    scoreBreakdown: m.scoreBreakdown as Record<string, number>,
    reasoning: m.reasoning,
    status: "PENDING" as const,
  }));

  // Use createMany with skipDuplicates to avoid conflicts
  await prisma.match.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * Get the next batch of matches for swiping.
 * Returns PENDING matches ordered by score.
 */
export async function getNextMatches(
  organizationId: string,
  limit: number = 10
) {
  return prisma.match.findMany({
    where: {
      organizationId,
      status: "PENDING",
    },
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
