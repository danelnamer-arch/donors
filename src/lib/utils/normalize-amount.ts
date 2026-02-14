/**
 * Grant amount normalization utility.
 * AI models sometimes return amounts in inconsistent units (millions, thousands, or raw dollars).
 * This normalizes all amounts to whole US dollars.
 */

/**
 * Normalize a grant amount to whole US dollars.
 *
 * Heuristic:
 *   - amount < 100     → likely in millions (e.g. 0.19 = $190K, 5.0 = $5M)
 *   - 100 ≤ amount < 1000 → likely in thousands (e.g. 250 = $250K)
 *   - amount ≥ 1000    → already in whole dollars
 */
export function normalizeGrantAmount(
  amount: number | null | undefined
): number | undefined {
  if (amount == null || amount <= 0) return undefined;

  // Values under 100 are almost certainly in millions
  // (no real grant is $0.19 or $50)
  if (amount < 100) {
    return Math.round(amount * 1_000_000);
  }

  // Values between 100 and 999 are likely in thousands
  // (very few grants are exactly $100-$999)
  if (amount < 1000) {
    return Math.round(amount * 1_000);
  }

  // Values >= 1000 are assumed to already be in whole dollars
  return Math.round(amount);
}

/**
 * Normalize totalGivingUsd and avgGrantSizeUsd fields.
 * These follow similar patterns but totalGiving tends to be larger.
 */
export function normalizeTotalGiving(
  amount: number | null | undefined
): number | undefined {
  if (amount == null || amount <= 0) return undefined;

  // Total giving under 1000 is almost certainly in millions
  if (amount < 1000) {
    return Math.round(amount * 1_000_000);
  }

  return Math.round(amount);
}

// ─── Enhanced version with confidence tracking ────────────────────

export interface NormalizedAmount {
  /** Normalized value in whole USD, or undefined if suspicious */
  value: number | undefined;
  /** How confident we are in the normalization */
  confidence: "high" | "medium" | "low";
  /** Whether the value was transformed (not just rounded) */
  wasNormalized: boolean;
  /** The original input value for audit purposes */
  originalValue: number | null | undefined;
}

/**
 * Enhanced grant amount normalization with confidence tracking.
 *
 * Same heuristic as normalizeGrantAmount but returns metadata about
 * the normalization so callers can flag uncertain values.
 *
 * Amounts exceeding $50B are flagged as suspicious (returns undefined).
 */
export function normalizeGrantAmountWithConfidence(
  amount: number | null | undefined
): NormalizedAmount {
  if (amount == null || amount <= 0) {
    return { value: undefined, confidence: "high", wasNormalized: false, originalValue: amount };
  }

  // Already in whole dollars — high confidence
  if (amount >= 1000) {
    if (amount > 50_000_000_000) {
      // Exceeds $50B — suspicious
      return { value: undefined, confidence: "low", wasNormalized: false, originalValue: amount };
    }
    return { value: Math.round(amount), confidence: "high", wasNormalized: false, originalValue: amount };
  }

  // Under 100 — assumed millions (medium confidence)
  if (amount < 100) {
    return {
      value: Math.round(amount * 1_000_000),
      confidence: "medium",
      wasNormalized: true,
      originalValue: amount,
    };
  }

  // 100-999 — assumed thousands (medium confidence)
  return {
    value: Math.round(amount * 1_000),
    confidence: "medium",
    wasNormalized: true,
    originalValue: amount,
  };
}
