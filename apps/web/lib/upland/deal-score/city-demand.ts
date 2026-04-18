// City demand multiplier resolution. For most cases the static override map
// in weights.ts is plenty. This file exists so future iterations can plug in
// a dynamic source (e.g. city_stats_view rankings) without touching compute.ts.

import { DEAL_SCORE_WEIGHTS, type DealScoreWeights } from "./weights";

export function resolveCityMultiplier(
  city: string,
  weights: DealScoreWeights = DEAL_SCORE_WEIGHTS,
): number {
  return weights.cityDemandOverrides[city] ?? weights.cityDemandDefault;
}

/**
 * Derive an override map from aggregate city stats (for future dynamic tuning).
 * Takes a list of { city, propertyCount, forSaleCount } rows and produces a
 * multiplier in [0.8, 1.2] based on liquidity proxies.
 *
 * Intentionally side-effect-free so callers can choose to merge this into the
 * static weights bundle or discard it. Currently unused by the live path;
 * wired in when we decide to replace the hand-tuned defaults.
 */
export function deriveCityMultipliersFromStats(
  rows: Array<{ city: string; propertyCount: number; forSaleCount: number }>,
): Record<string, number> {
  if (rows.length === 0) return {};
  // Liquidity ratio: for-sale / total. Higher = more liquid = more demand signal.
  const ratios = rows
    .filter((r) => r.propertyCount > 0)
    .map((r) => ({
      city: r.city,
      ratio: r.forSaleCount / r.propertyCount,
    }));
  if (ratios.length === 0) return {};
  const mean =
    ratios.reduce((sum, r) => sum + r.ratio, 0) / ratios.length || 1;
  const out: Record<string, number> = {};
  for (const r of ratios) {
    const raw = r.ratio / mean; // 1.0 = average; >1 = more liquid; <1 = less.
    out[r.city] = Math.max(0.8, Math.min(1.2, raw));
  }
  return out;
}
