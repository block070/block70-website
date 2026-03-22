/**
 * Format USD price with at least 2 decimal places.
 * Examples: $1.00, $69.13, $0.001
 */
export function formatPrice(value: number): string {
  if (value == null || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "$0.00";
  }
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
  return `$${formatted}`;
}

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

/**
 * Format netflow with sign: +$120M, -$80M
 */
export function formatNetflow(value: number): string {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value >= 0 ? "+" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}$${(value / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(value)}`;
}
