/**
 * Donor Search Engine
 * Combines full-text search (PostgreSQL tsvector) with
 * vector similarity search (pgvector) for semantic matching.
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
 * Search donors using full-text search.
 */
export async function searchDonorsFullText(
  params: DonorSearchParams
): Promise<DonorSearchResult[]> {
  const { query, type, causes, countries, limit = 20, offset = 0 } = params;

  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (query) {
    conditions.push(
      `(d."name" ILIKE $${paramIndex} OR d."description" ILIKE $${paramIndex})`
    );
    values.push(`%${query}%`);
    paramIndex++;
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

  if (params.minDataQuality) {
    conditions.push(`d."dataQualityScore" >= $${paramIndex}`);
    values.push(params.minDataQuality);
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
      1.0 as "relevanceScore",
      (SELECT COUNT(*) FROM "DonorGrant" g WHERE g."donorId" = d.id) as "grantCount"
    FROM "Donor" d
    WHERE ${conditions.join(" AND ")}
    ORDER BY d."dataQualityScore" DESC, d.name ASC
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
      resultMap.set(r.id, { ...r, relevanceScore: r.relevanceScore * 0.7 });
    }
  }

  // Sort by relevance and return
  return Array.from(resultMap.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
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
