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
