import type { Coin } from "@/lib/crypto-mock";

export type TrendLabel = "Bull" | "Neutral" | "Bear";

export type ScannerCoin = Coin & {
  block70Score: number;
  trendLabel: TrendLabel;
  sparkline7d: number[];
};

/** Map Block70 score to trend bucket (spec: 0–30 Bear, 31–70 Neutral, 71–100 Bull). */
export function trendFromScore(score: number): TrendLabel {
  if (score <= 30) return "Bear";
  if (score <= 70) return "Neutral";
  return "Bull";
}

/**
 * Synthetic 7d sparkline from current price and 7d % change (no extra API calls).
 */
export function syntheticSparkline7d(price: number, pct7d: number | typeof NaN): number[] {
  const n = 8;
  const p = Number.isFinite(price) && price > 0 ? price : 0;
  const pct = typeof pct7d === "number" && Number.isFinite(pct7d) ? pct7d : 0;
  if (p <= 0) return Array(n).fill(0);
  const start = pct === 0 ? p : p / (1 + pct / 100);
  return Array.from({ length: n }, (_, i) => start + (p - start) * (i / (n - 1)));
}

/**
 * Block70 score 0–100 from momentum + liquidity proxy (deterministic, client-side).
 */
export function computeBlock70Score(c: Coin): number {
  const p24 = typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct) ? c.change24hPct : 0;
  const p7 = typeof c.change7dPct === "number" && Number.isFinite(c.change7dPct) ? c.change7dPct : 0;
  const vol = Math.max(0, c.volume24hUsd ?? 0);
  const mcap = Math.max(1, c.marketCapUsd ?? 1);
  const liquiditySignal = Math.min(25, Math.log10(vol / mcap + 1) * 12);
  const momentum = p24 * 0.55 + p7 * 0.35;
  const raw = 50 + momentum * 0.45 + liquiditySignal * 0.4;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function enrichCoin(c: Coin): ScannerCoin {
  const block70Score = computeBlock70Score(c);
  const trendLabel = trendFromScore(block70Score);
  const sparkline7d = syntheticSparkline7d(c.priceUsd, c.change7dPct);
  return {
    ...c,
    block70Score,
    trendLabel,
    sparkline7d,
  };
}

export function enrichCoins(coins: Coin[]): ScannerCoin[] {
  return coins.map(enrichCoin);
}

export type FilterPreset = "gainers" | "losers" | "score" | "trending";

export type ColumnSortKey = "score" | "mcap" | "volume";

export type ColumnSort = {
  key: ColumnSortKey | null;
  dir: "asc" | "desc";
};
