/**
 * Smart currency formatting for grant amounts.
 * Displays large numbers in human-readable format (e.g. $5.0M, $250K).
 */

export function formatGrantAmount(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  // Safety net: suspiciously small amounts that weren't normalized
  if (amount < 100) {
    return "Amount TBD";
  }
  return `$${amount.toLocaleString()}`;
}
