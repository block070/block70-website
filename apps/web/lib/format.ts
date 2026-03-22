/**
 * Format percentage for 24h/7d change. Returns "—" when value is NaN or invalid.
 */
export function formatChangePct(value: number): string {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Format large USD values with B/M/K suffixes.
 * Examples: $26B, $240M, $250K, $0
 */
export function formatCompactUsd(value: number): string {
  if (value == null || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "$0";
  }
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}
