/**
 * Matching Engine v2
 * Scores donors against organizations and generates data-rich reasoning.
 *
 * Scoring weights:
 *   1. Cause alignment (30%)
 *   2. Geographic overlap (20%) — includes activeRegions
 *   3. Data quality (20%)
 *   4. Population overlap (15%)
 *   5. Semantic similarity (15%)
 *
 * The score is NEVER shown to users — only the reasoning.
 * Reasoning now includes concrete grant data, amounts, and recipients.
 */

import { prisma } from "@/lib/prisma";
import { generateMatchReasoning as geminiReasoning } from "@/lib/gemini";
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

  // Find candidates
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

/**
 * Find donor candidates with enriched data.
 */
async function findCandidates(
  org: { id: string; causes: string[]; targetPopulations: string[]; geographicFocus: string[]; mission: string | null },
  excludeIds: string[],
  limit: number
): Promise<MatchCandidate[]> {
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
      COALESCE(d."activeRegions", '{}') as "donorActiveRegions",
      d.country as "donorCountry",
      d.website as "donorWebsite",
      COALESCE(d."websiteVerified", false) as "donorWebsiteVerified",
      d."totalGivingUsd",
      d."avgGrantSizeUsd",
      COALESCE(d."grantCount", 0) as "donorGrantCount",
      d."dataQualityScore"
    FROM "Donor" d
    WHERE 1=1
    ${causeFilter}
    ${excludeFilter}
    ORDER BY d."dataQualityScore" DESC
    LIMIT $${allValues.length}
  `;

  const results = await prisma.$queryRawUnsafe<MatchCandidate[]>(sql, ...allValues);

  // If not enough from cause filtering, get more by data quality
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
        COALESCE(d."activeRegions", '{}') as "donorActiveRegions",
        d.country as "donorCountry",
        d.website as "donorWebsite",
        COALESCE(d."websiteVerified", false) as "donorWebsiteVerified",
        d."totalGivingUsd",
        d."avgGrantSizeUsd",
        COALESCE(d."grantCount", 0) as "donorGrantCount",
        d."dataQualityScore"
      FROM "Donor" d
      WHERE 1=1
      ${moreExclude}
      ORDER BY d."dataQualityScore" DESC
      LIMIT ${limitParam}
    `;

    const moreResults = await prisma.$queryRawUnsafe<MatchCandidate[]>(moreSql, ...moreValues);
    results.push(...moreResults);
  }

  return results;
}

/**
 * Score a candidate against the organization.
 * Now considers activeRegions for geographic overlap.
 */
function scoreCandidate(
  org: { causes: string[]; targetPopulations: string[]; geographicFocus: string[] },
  candidate: MatchCandidate
): ScoredMatch["scoreBreakdown"] {
  const causeAlignment = jaccardSimilarity(org.causes, candidate.donorCauses);

  // Geographic: combine geographicFocus + activeRegions
  const allDonorGeo = [...candidate.donorGeoFocus, ...candidate.donorActiveRegions];
  const geographicOverlap = jaccardSimilarity(org.geographicFocus, allDonorGeo);

  const populationOverlap = jaccardSimilarity(org.targetPopulations, candidate.donorPopulations);

  return {
    causeAlignment,
    geographicOverlap,
    populationOverlap,
    semanticSimilarity: 0.5,
    dataQuality: candidate.dataQualityScore,
  };
}

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
      if (g.amount) parts.push(`$${Math.round(g.amount / 1000)}K`);
      if (g.year) parts.push(`(${g.year})`);
      return parts.join(" — ");
    }).join("; ");

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

Donor "${candidate.donorName}" (${candidate.donorType}): ${candidate.donorDescription || "N/A"}. Causes: ${candidate.donorCauses.join(", ") || "N/A"}. Regions: ${[...candidate.donorGeoFocus, ...candidate.donorActiveRegions].join(", ") || "N/A"}.${candidate.totalGivingUsd ? ` Total giving: ~$${Math.round(candidate.totalGivingUsd / 1_000_000 * 10) / 10}M.` : ""}${candidate.donorGrantCount ? ` ${candidate.donorGrantCount} grants on record.` : ""}
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
      ? `including a $${Math.round(topGrant.amount / 1000)}K grant to ${topGrant.recipientName}`
      : `including grants to ${topGrant.recipientName}`;
    parts.push(grantStr);
  }

  // Total giving
  if (candidate.totalGivingUsd && candidate.totalGivingUsd > 0) {
    parts.push(`with ~$${Math.round(candidate.totalGivingUsd / 1_000_000 * 10) / 10}M in total giving`);
  }

  if (parts.length > 0) {
    return parts.join(", ") + ".";
  }

  return `${candidate.donorName} is a ${candidate.donorType.toLowerCase()} that supports causes relevant to your organization.`;
}

/** Jaccard similarity (case-insensitive). */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a.map((s) => s.toLowerCase()));
  const setB = new Set(b.map((s) => s.toLowerCase()));
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

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
