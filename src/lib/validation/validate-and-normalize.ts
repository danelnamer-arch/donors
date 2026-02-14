/**
 * Validate & Normalize — convenience wrappers for data entry points.
 *
 * Combines Zod schema validation, cause normalization, and quality
 * score computation into single function calls. Every data entry
 * point should call one of these before writing to the database.
 */

import {
  donorCreateSchema,
  donorUpdateSchema,
  grantSchema,
  publicationSchema,
} from "./donor-schemas";
import {
  computeQualityScore,
  combineQualityScores,
} from "./compute-quality-score";
import { normalizeCauses } from "@/lib/utils/normalize-causes";
import type { DonorCreateInput, DonorUpdateInput, GrantInput, PublicationInput } from "./donor-schemas";

// ─── Result type ──────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: { path: string; message: string }[];
}

// ─── Donor creation ───────────────────────────────────────────────

/**
 * Validate and normalize a full donor for creation.
 *
 * Applies:
 *   1. Zod schema validation (types, bounds, formats)
 *   2. Cause normalization (free text → canonical)
 *   3. Deterministic quality score (optionally combined with AI score)
 *
 * Used by: orchestrator.storeDonor(), IRS 990 importer, seed scripts
 */
export function validateDonorCreate(
  input: unknown,
  options?: { aiQualityScore?: number }
): ValidationResult<DonorCreateInput & { dataQualityScore: number }> {
  const result = donorCreateSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  const data = result.data;

  // Normalize causes to canonical taxonomy
  if (data.causes.length > 0) {
    data.causes = normalizeCauses(data.causes);
  }

  // Compute deterministic quality score
  const qualityBreakdown = computeQualityScore({
    name: data.name,
    description: data.description,
    website: data.website,
    websiteVerified: data.websiteVerified,
    causes: data.causes,
    targetPopulations: data.targetPopulations,
    geographicFocus: data.geographicFocus,
    activeRegions: data.activeRegions,
    headquartersCountry: data.headquartersCountry,
    headquartersCity: data.headquartersCity,
    totalGivingUsd: data.totalGivingUsd,
    avgGrantSizeUsd: data.avgGrantSizeUsd,
    email: data.email,
    phone: data.phone,
    grantCount: data.grantCount,
    dataSources: data.dataSources,
  });

  // Combine with AI score if provided (70% deterministic, 30% AI)
  data.dataQualityScore = combineQualityScores(
    qualityBreakdown.total,
    options?.aiQualityScore
  );

  return {
    success: true,
    data: data as DonorCreateInput & { dataQualityScore: number },
  };
}

// ─── Donor update ─────────────────────────────────────────────────

/**
 * Validate a partial donor update.
 *
 * Applies:
 *   1. Zod schema validation (same rules, all fields optional)
 *   2. Cause normalization (if causes are being updated)
 *   3. Strips unknown fields automatically
 *
 * Used by: admin PATCH, apply-changes
 */
export function validateDonorUpdate(
  input: unknown
): ValidationResult<DonorUpdateInput> {
  const result = donorUpdateSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  const data = result.data;

  // Normalize causes if being updated
  if (data.causes && data.causes.length > 0) {
    data.causes = normalizeCauses(data.causes);
  }

  return { success: true, data };
}

// ─── Grant validation ─────────────────────────────────────────────

/**
 * Validate a single grant entry.
 * Checks: recipient name required, amount $1-$50B, year 1900-current+1
 *
 * Used by: orchestrator.storeDonor(), apply-changes
 */
export function validateGrant(
  input: unknown
): ValidationResult<GrantInput> {
  const result = grantSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  return { success: true, data: result.data };
}

// ─── Publication validation ───────────────────────────────────────

/**
 * Validate a single publication entry.
 * Checks: title required, type enum, valid URL
 */
export function validatePublication(
  input: unknown
): ValidationResult<PublicationInput> {
  const result = publicationSchema.safeParse(input);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  return { success: true, data: result.data };
}
