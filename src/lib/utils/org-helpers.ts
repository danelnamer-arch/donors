/**
 * Helper functions to work with Organization Json[] fields.
 *
 * The `similarOrgs` and `existingDonors` columns are stored as Json[]
 * (arrays of objects). These helpers provide type-safe access.
 */

// ─── JsonValue type (Prisma-compatible) ─────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonValue = string | number | boolean | null | { [key: string]: any } | any[];

// ─── Types ──────────────────────────────────────────────

export interface SimilarOrg {
  name: string;
  registrationNumber?: string;
  website?: string;
}

export interface ExistingDonor {
  name: string;
  website?: string;
}

// ─── Extractors ─────────────────────────────────────────

/** Extract an array of SimilarOrg objects from Prisma Json[] */
export function parseSimilarOrgs(raw: JsonValue[] | JsonValue | null | undefined): SimilarOrg[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: String(item.name ?? ""),
      ...(item.registrationNumber ? { registrationNumber: String(item.registrationNumber) } : {}),
      ...(item.website ? { website: String(item.website) } : {}),
    }))
    .filter((o) => o.name.length > 0);
}

/** Extract an array of ExistingDonor objects from Prisma Json[] */
export function parseExistingDonors(raw: JsonValue[] | JsonValue | null | undefined): ExistingDonor[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: String(item.name ?? ""),
      ...(item.website ? { website: String(item.website) } : {}),
    }))
    .filter((d) => d.name.length > 0);
}

/** Get just the names from similarOrgs for backward-compatible matching */
export function getSimilarOrgNames(raw: JsonValue[] | JsonValue | null | undefined): string[] {
  return parseSimilarOrgs(raw).map((o) => o.name);
}

/** Get just the names from existingDonors for backward-compatible matching */
export function getExistingDonorNames(raw: JsonValue[] | JsonValue | null | undefined): string[] {
  return parseExistingDonors(raw).map((d) => d.name);
}

/** Convert SimilarOrg[] to Prisma Json[] for storage */
export function similarOrgsToJson(orgs: SimilarOrg[]): JsonValue[] {
  return orgs.map((o) => ({
    name: o.name,
    ...(o.registrationNumber ? { registrationNumber: o.registrationNumber } : {}),
    ...(o.website ? { website: o.website } : {}),
  })) as JsonValue[];
}

/** Convert ExistingDonor[] to Prisma Json[] for storage */
export function existingDonorsToJson(donors: ExistingDonor[]): JsonValue[] {
  return donors.map((d) => ({
    name: d.name,
    ...(d.website ? { website: d.website } : {}),
  })) as JsonValue[];
}
