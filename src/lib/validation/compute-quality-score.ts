/**
 * Deterministic Data Quality Scoring
 *
 * Computes a transparent quality score (0-1) based on field completeness.
 * Replaces hardcoded scores (0.3 for IRS imports) and AI-generated scores
 * with a predictable, explainable algorithm.
 *
 * Scoring breakdown (max 1.0):
 *   Description   0.10-0.15  (present + length bonus)
 *   Website       0.05-0.10  (present + verified bonus)
 *   Causes        0.10-0.15  (present + 3+ bonus)
 *   Geography     0.10       (geographicFocus or headquartersCountry)
 *   Grants        0.10-0.15  (present + 5+ bonus)
 *   Giving stats  0.05-0.10  (totalGivingUsd + avgGrant bonus)
 *   Contact       0.05       (email or phone)
 *   Regions       0.05       (activeRegions populated)
 *   Sources       0.05-0.10  (1+ data sources, 3+ bonus)
 *   Populations   0.05       (targetPopulations populated)
 */

export interface QualityScoreInput {
  name: string;
  description?: string | null;
  website?: string | null;
  websiteVerified?: boolean;
  causes: string[];
  targetPopulations: string[];
  geographicFocus: string[];
  activeRegions?: string[];
  headquartersCountry?: string | null;
  headquartersCity?: string | null;
  totalGivingUsd?: number | null;
  avgGrantSizeUsd?: number | null;
  email?: string | null;
  phone?: string | null;
  grantCount: number;
  dataSources: unknown[];
}

export interface QualityBreakdown {
  hasDescription: number;
  hasWebsite: number;
  hasCauses: number;
  hasGeography: number;
  hasGrants: number;
  hasGivingStats: number;
  hasContact: number;
  hasActiveRegions: number;
  hasMultipleSources: number;
  hasTargetPopulations: number;
  total: number;
}

/**
 * Compute a deterministic quality score from donor field completeness.
 * Returns a breakdown object with per-factor scores and a total.
 */
export function computeQualityScore(input: QualityScoreInput): QualityBreakdown {
  const breakdown: QualityBreakdown = {
    hasDescription: 0,
    hasWebsite: 0,
    hasCauses: 0,
    hasGeography: 0,
    hasGrants: 0,
    hasGivingStats: 0,
    hasContact: 0,
    hasActiveRegions: 0,
    hasMultipleSources: 0,
    hasTargetPopulations: 0,
    total: 0,
  };

  // Description: 0.10 base, +0.05 for >100 chars
  if (input.description && input.description.trim().length > 0) {
    breakdown.hasDescription = input.description.trim().length > 100 ? 0.15 : 0.10;
  }

  // Website: 0.05 base, 0.10 if verified
  if (input.website) {
    breakdown.hasWebsite = input.websiteVerified ? 0.10 : 0.05;
  }

  // Causes: 0.10 base, 0.15 if 3+
  if (input.causes.length > 0) {
    breakdown.hasCauses = input.causes.length >= 3 ? 0.15 : 0.10;
  }

  // Geography: 0.10 (geographicFocus or headquartersCountry)
  if (input.geographicFocus.length > 0 || input.headquartersCountry) {
    breakdown.hasGeography = 0.10;
  }

  // Grants: 0.10 base, 0.15 if 5+
  if (input.grantCount > 0) {
    breakdown.hasGrants = input.grantCount >= 5 ? 0.15 : 0.10;
  }

  // Giving stats: 0.05 for totalGivingUsd, +0.05 for avgGrantSizeUsd
  if (input.totalGivingUsd != null && input.totalGivingUsd > 0) {
    breakdown.hasGivingStats =
      input.avgGrantSizeUsd != null && input.avgGrantSizeUsd > 0 ? 0.10 : 0.05;
  }

  // Contact info: 0.05
  if (input.email || input.phone) {
    breakdown.hasContact = 0.05;
  }

  // Active regions: 0.05
  if (input.activeRegions && input.activeRegions.length > 0) {
    breakdown.hasActiveRegions = 0.05;
  }

  // Data sources: 0.05 for 1-2, 0.10 for 3+
  if (input.dataSources.length >= 3) {
    breakdown.hasMultipleSources = 0.10;
  } else if (input.dataSources.length >= 1) {
    breakdown.hasMultipleSources = 0.05;
  }

  // Target populations: 0.05
  if (input.targetPopulations.length > 0) {
    breakdown.hasTargetPopulations = 0.05;
  }

  // Sum and cap at 1.0, round to 2 decimals
  const raw =
    breakdown.hasDescription +
    breakdown.hasWebsite +
    breakdown.hasCauses +
    breakdown.hasGeography +
    breakdown.hasGrants +
    breakdown.hasGivingStats +
    breakdown.hasContact +
    breakdown.hasActiveRegions +
    breakdown.hasMultipleSources +
    breakdown.hasTargetPopulations;

  breakdown.total = Math.min(1.0, Math.round(raw * 100) / 100);

  return breakdown;
}

/**
 * Combine deterministic score with an optional AI validator score.
 *
 * Deterministic score gets 70% weight; AI score gets 30%.
 * If no AI score is provided (or it's out of bounds), the
 * deterministic score is used alone.
 */
export function combineQualityScores(
  deterministicScore: number,
  aiScore?: number | null
): number {
  if (aiScore == null || aiScore < 0 || aiScore > 1) {
    return deterministicScore;
  }
  return Math.round((deterministicScore * 0.7 + aiScore * 0.3) * 100) / 100;
}
