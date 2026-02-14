/**
 * Donor Search Engine v2
 *
 * Combines PostgreSQL full-text search (tsvector) with
 * vector similarity search (pgvector) for semantic matching.
 *
 * v2 improvements:
 * - Full-text search via tsvector + ts_rank (was ILIKE)
 * - Combined search merging text + semantic results
 * - ILIKE fallback when tsvector returns no results
 * - Better relevance scoring
 */

import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/openai";

export interface DonorSearchParams {
  // Text search
  query?: string;

  // Filters
  type?: ("FOUNDATION" | "INDIVIDUAL" | "CORPORATE" | "GOVERNMENT" | "OTHER")[];
  causes?: string[];
  targetPopulations?: string[];
  geographicFocus?: string[];
  countries?: string[];
  politicalAffiliation?: string[];
  minDataQuality?: number;

  // Semantic search (uses embeddings)
  semanticQuery?: string;
  similarToOrgId?: string;

  // Pagination
  limit?: number;
  offset?: number;

  // Sort
  sortBy?: "relevance" | "quality" | "totalGiving" | "name";
}

export interface DonorSearchResult {
  id: string;
  name: string;
  type: string;
  description: string | null;
  website: string | null;
  country: string | null;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  dataQualityScore: number;
  relevanceScore: number;
  grantCount: number;
}

/**
 * Full-text search using PostgreSQL tsvector with ts_rank.
 * Falls back to ILIKE if tsvector returns no results.
 */
export async function searchDonorsFullText(
  params: DonorSearchParams
): Promise<DonorSearchResult[]> {
  const { query, type, causes, countries, limit = 20, offset = 0 } = params;

  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  let paramIndex = 1;
  let hasTextSearch = false;
  let rankExpr = "1.0";

  if (query) {
    // Use tsvector full-text search with ILIKE fallback
    conditions.push(
      `(to_tsvector('english', COALESCE(d."name",'') || ' ' || COALESCE(d."description",'') || ' ' || array_to_string(d."causes", ' '))
        @@ websearch_to_tsquery('english', $${paramIndex})
       OR d."name" ILIKE $${paramIndex + 1}
       OR d."description" ILIKE $${paramIndex + 1})`
    );
    rankExpr = `COALESCE(
      ts_rank(
        to_tsvector('english', COALESCE(d."name",'') || ' ' || COALESCE(d."description",'') || ' ' || array_to_string(d."causes", ' ')),
        websearch_to_tsquery('english', $${paramIndex})
      ), 0
    ) + CASE WHEN d."name" ILIKE $${paramIndex + 1} THEN 0.5 ELSE 0 END`;
    values.push(query, `%${query}%`);
    paramIndex += 2;
    hasTextSearch = true;
  }

  if (type?.length) {
    conditions.push(`d."type" = ANY($${paramIndex}::text[])`);
    values.push(type);
    paramIndex++;
  }

  if (causes?.length) {
    conditions.push(`d."causes" && $${paramIndex}::text[]`);
    values.push(causes);
    paramIndex++;
  }

  if (countries?.length) {
    conditions.push(`d."country" = ANY($${paramIndex}::text[])`);
    values.push(countries);
    paramIndex++;
  }

  if (params.geographicFocus?.length) {
    conditions.push(`d."geographicFocus" && $${paramIndex}::text[]`);
    values.push(params.geographicFocus);
    paramIndex++;
  }

  if (params.targetPopulations?.length) {
    conditions.push(`d."targetPopulations" && $${paramIndex}::text[]`);
    values.push(params.targetPopulations);
    paramIndex++;
  }

  if (params.minDataQuality) {
    conditions.push(`d."dataQualityScore" >= $${paramIndex}`);
    values.push(params.minDataQuality);
    paramIndex++;
  }

  // Determine sort order
  let orderBy: string;
  if (hasTextSearch) {
    orderBy = `"relevanceScore" DESC, d."dataQualityScore" DESC`;
  } else {
    switch (params.sortBy) {
      case "quality":
        orderBy = `d."dataQualityScore" DESC, d.name ASC`;
        break;
      case "totalGiving":
        orderBy = `COALESCE(d."totalGivingUsd", 0) DESC, d.name ASC`;
        break;
      case "name":
        orderBy = `d.name ASC`;
        break;
      default:
        orderBy = `d."dataQualityScore" DESC, d.name ASC`;
    }
  }

  const sql = `
    SELECT
      d.id,
      d.name,
      d.type,
      d.description,
      d.website,
      d.country,
      d.causes,
      d."targetPopulations",
      d."geographicFocus",
      d."dataQualityScore",
      ${rankExpr} as "relevanceScore",
      (SELECT COUNT(*) FROM "DonorGrant" g WHERE g."donorId" = d.id) as "grantCount"
    FROM "Donor" d
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  values.push(limit, offset);

  const results = await prisma.$queryRawUnsafe<DonorSearchResult[]>(sql, ...values);
  return results;
}

/**
 * Search donors using vector similarity (semantic search).
 * Finds donors whose mission/causes are semantically similar to the query.
 */
export async function searchDonorsSemantic(
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    excludeIds?: string[];
    type?: string[];
    causes?: string[];
  }
): Promise<DonorSearchResult[]> {
  const limit = options?.limit ?? 20;
  const minSimilarity = options?.minSimilarity ?? 0.3;

  // Generate embedding for the search query
  const embedding = await generateEmbedding(query);
  const embeddingStr = JSON.stringify(embedding);

  const conditions: string[] = [`d."missionEmbedding" IS NOT NULL`];
  const values: unknown[] = [embeddingStr, limit];
  let paramIndex = 3;

  if (options?.excludeIds?.length) {
    conditions.push(`d.id != ALL($${paramIndex}::text[])`);
    values.push(options.excludeIds);
    paramIndex++;
  }

  if (options?.type?.length) {
    conditions.push(`d."type" = ANY($${paramIndex}::text[])`);
    values.push(options.type);
    paramIndex++;
  }

  if (options?.causes?.length) {
    conditions.push(`d."causes" && $${paramIndex}::text[]`);
    values.push(options.causes);
    paramIndex++;
  }

  const sql = `
    SELECT
      d.id,
      d.name,
      d.type,
      d.description,
      d.website,
      d.country,
      d.causes,
      d."targetPopulations",
      d."geographicFocus",
      d."dataQualityScore",
      1 - (d."missionEmbedding" <=> $1::vector) as "relevanceScore",
      (SELECT COUNT(*) FROM "DonorGrant" g WHERE g."donorId" = d.id) as "grantCount"
    FROM "Donor" d
    WHERE ${conditions.join(" AND ")}
      AND 1 - (d."missionEmbedding" <=> $1::vector) >= ${minSimilarity}
    ORDER BY d."missionEmbedding" <=> $1::vector ASC
    LIMIT $2
  `;

  const results = await prisma.$queryRawUnsafe<DonorSearchResult[]>(sql, ...values);
  return results;
}

/**
 * Combined search: merges full-text + semantic results with blended ranking.
 * This is the recommended search function for user-facing queries.
 *
 * Strategy:
 * 1. Run full-text search (tsvector) for keyword matches
 * 2. Run semantic search (pgvector) for meaning matches
 * 3. Merge with combined score: 0.4 * textRank + 0.6 * semanticRank
 */
export async function searchDonorsCombined(
  params: DonorSearchParams
): Promise<DonorSearchResult[]> {
  const { query, limit = 20, offset = 0 } = params;

  if (!query) {
    // No query — just run filtered full-text search
    return searchDonorsFullText(params);
  }

  // Run both searches in parallel
  const [textResults, semanticResults] = await Promise.all([
    searchDonorsFullText({ ...params, limit: limit * 2, offset: 0 }),
    searchDonorsSemantic(query, {
      limit: limit * 2,
      minSimilarity: 0.2,
      type: params.type,
      causes: params.causes,
    }).catch(() => [] as DonorSearchResult[]), // Graceful fallback if embedding fails
  ]);

  // Normalize text relevance scores to 0-1 range
  const maxTextScore = Math.max(...textResults.map((r) => Number(r.relevanceScore)), 0.001);

  // Merge into combined map
  const resultMap = new Map<string, DonorSearchResult & { textScore: number; semanticScore: number }>();

  for (const r of textResults) {
    resultMap.set(r.id, {
      ...r,
      textScore: Number(r.relevanceScore) / maxTextScore,
      semanticScore: 0,
    });
  }

  for (const r of semanticResults) {
    const existing = resultMap.get(r.id);
    if (existing) {
      existing.semanticScore = Number(r.relevanceScore);
    } else {
      resultMap.set(r.id, {
        ...r,
        textScore: 0,
        semanticScore: Number(r.relevanceScore),
      });
    }
  }

  // Apply filters that weren't in the SQL (geographicFocus, targetPopulations)
  let results = Array.from(resultMap.values());

  if (params.geographicFocus?.length) {
    results = results.filter((r) =>
      r.geographicFocus.some((gf) =>
        params.geographicFocus!.some((f) => gf.toLowerCase().includes(f.toLowerCase()))
      )
    );
  }

  // Compute blended score
  for (const r of results) {
    r.relevanceScore = 0.4 * r.textScore + 0.6 * r.semanticScore;
  }

  // Sort by combined relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Apply offset and limit
  return results.slice(offset, offset + limit);
}

/**
 * Find donors similar to a given organization.
 * This is the core of the matching engine.
 */
export async function findDonorsForOrg(
  orgId: string,
  options?: {
    limit?: number;
    excludeDonorIds?: string[];
  }
): Promise<DonorSearchResult[]> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const limit = options?.limit ?? 30;
  const excludeIds = options?.excludeDonorIds ?? [];

  // Build a rich search query from org profile
  const searchQuery = [
    org.mission,
    org.causes.length ? `Causes: ${org.causes.join(", ")}` : null,
    org.targetPopulations.length ? `Populations: ${org.targetPopulations.join(", ")}` : null,
    org.geographicFocus.length ? `Geographic focus: ${org.geographicFocus.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  // Run semantic search and filtered search in parallel
  const [semanticResults, filteredResults] = await Promise.all([
    searchDonorsSemantic(searchQuery, {
      limit,
      excludeIds,
      minSimilarity: 0.2,
    }),
    searchDonorsFullText({
      causes: org.causes.length ? org.causes : undefined,
      limit,
      offset: 0,
    }),
  ]);

  // Merge and deduplicate results, preferring semantic matches
  const resultMap = new Map<string, DonorSearchResult>();

  for (const r of semanticResults) {
    if (!excludeIds.includes(r.id)) {
      resultMap.set(r.id, r);
    }
  }

  for (const r of filteredResults) {
    if (!excludeIds.includes(r.id) && !resultMap.has(r.id)) {
      resultMap.set(r.id, { ...r, relevanceScore: Number(r.relevanceScore) * 0.7 });
    }
  }

  // Sort by relevance and return
  return Array.from(resultMap.values())
    .sort((a, b) => Number(b.relevanceScore) - Number(a.relevanceScore))
    .slice(0, limit);
}

/**
 * Find donors similar to a specific donor.
 * Used for "if you like this donor, you might also like..." recommendations.
 */
export async function findSimilarDonors(
  donorId: string,
  limit: number = 10
): Promise<DonorSearchResult[]> {
  const donor = await prisma.donor.findUnique({ where: { id: donorId } });
  if (!donor) throw new Error("Donor not found");

  const searchQuery = [
    donor.description,
    donor.causes.length ? `Causes: ${donor.causes.join(", ")}` : null,
    donor.targetPopulations.length ? `Populations: ${donor.targetPopulations.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return searchDonorsSemantic(searchQuery, {
    limit: limit + 1,
    excludeIds: [donorId],
    minSimilarity: 0.3,
  });
}
