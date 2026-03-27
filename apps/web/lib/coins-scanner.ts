import type { Coin } from "@/lib/crypto-mock";
import { buildTags } from "@/lib/coin-scanner-tags";

export type TrendLabel = "Bull" | "Neutral" | "Bear";

export type ScannerCoin = Coin & {
  block70Score: number;
  trendLabel: TrendLabel;
  sparkline7d: number[];
};

/** Map Block70 score to trend bucket (0–30 Bear, 31–70 Neutral, 71–100 Bull). */
export function trendFromScore(score: number): TrendLabel {
  if (score <= 30) return "Bear";
  if (score <= 70) return "Neutral";
  return "Bull";
}

/**
 * Trend badge from price momentum (24h + 7d). Kept separate from block70Score so
 * labels aren’t all “Neutral” when scores cluster near 50 for large-caps.
 */
export function trendFromMomentum(p24: number, p7: number): TrendLabel {
  const a = p24 * 0.5 + p7 * 0.5;
  if (!Number.isFinite(a)) return "Neutral";
  if (a >= 1.25) return "Bull";
  if (a <= -1.25) return "Bear";
  return "Neutral";
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
 * Block70 score 0–100 from momentum + liquidity. Uses stronger momentum scaling so
 * top-100 rows spread across the band instead of clustering ~48–56.
 */
export function computeBlock70Score(c: Coin): number {
  const p24 = typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct) ? c.change24hPct : 0;
  const p7 = typeof c.change7dPct === "number" && Number.isFinite(c.change7dPct) ? c.change7dPct : 0;
  const vol = Math.max(0, c.volume24hUsd ?? 0);
  const mcap = Math.max(1, c.marketCapUsd ?? 1);
  const liquiditySignal = Math.min(18, Math.log10(vol / mcap + 1) * 9);
  const mom = p24 * 0.55 + p7 * 0.45;
  const momentumScaled = Math.min(42, Math.max(-42, mom * 1.35));
  const raw = 50 + momentumScaled * 0.82 + liquiditySignal * 0.45;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function enrichCoin(c: Coin): ScannerCoin {
  const p24 = typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct) ? c.change24hPct : 0;
  const p7 = typeof c.change7dPct === "number" && Number.isFinite(c.change7dPct) ? c.change7dPct : 0;
  const block70Score = computeBlock70Score(c);
  const trendLabel = trendFromMomentum(p24, p7);
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

export type CoinTagBundle = ReturnType<typeof buildTags>;

/**
 * Smart-money style score (0–100): blends composite momentum/liquidity (B70),
 * turnover (vol/mcap), and signal-tag density from `buildTags` (pass `tags` to avoid double work).
 */
export function computeSmartMoneyScore(c: Coin, tags?: CoinTagBundle): number {
  const base = computeBlock70Score(c);
  const mcap = Math.max(1, c.marketCapUsd ?? 1);
  const vol = Math.max(0, c.volume24hUsd ?? 0);
  const volToMcap = vol / mcap;
  const flow = Math.min(28, Math.log10(volToMcap + 1e-4) * 11);
  const { signalTags } = tags ?? buildTags(c);
  const tagBoost = Math.min(18, signalTags.length * 5);
  const raw = base * 0.6 + flow * 0.28 + tagBoost * 0.12;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export type TraderScannerRow = ScannerCoin & {
  narrativeTags: string[];
  categoryTags: string[];
  signalTags: string[];
  smartMoneyScore: number;
  volToMcap: number;
  /** Bucket from composite B70 score (liquidity + momentum model). */
  sentimentLabel: TrendLabel;
};

export function toTraderRow(c: Coin): TraderScannerRow {
  const base = enrichCoin(c);
  const tagBundle = buildTags(c);
  const { narrativeTags, categoryTags, signalTags } = tagBundle;
  const mcap = Math.max(1, c.marketCapUsd ?? 1);
  const vol = c.volume24hUsd ?? 0;
  const volToMcap = vol / mcap;
  const smartMoneyScore = computeSmartMoneyScore(c, tagBundle);
  const sentimentLabel = trendFromScore(base.block70Score);
  return {
    ...base,
    narrativeTags,
    categoryTags,
    signalTags,
    smartMoneyScore,
    volToMcap,
    sentimentLabel,
  };
}

export type TraderSortMode =
  | "default"
  | "trending"
  | "volume_spike"
  | "whale_accumulation";

export function applyTraderSort(
  rows: TraderScannerRow[],
  mode: TraderSortMode
): TraderScannerRow[] {
  const out = [...rows];
  if (mode === "trending") {
    out.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
  } else if (mode === "volume_spike") {
    out.sort((a, b) => b.volToMcap - a.volToMcap);
  } else if (mode === "whale_accumulation") {
    out.sort((a, b) => {
      const sb = (b.smartMoneyScore ?? 0) * (1 + Math.max(0, b.change24hPct ?? 0) / 50);
      const sa = (a.smartMoneyScore ?? 0) * (1 + Math.max(0, a.change24hPct ?? 0) / 50);
      return sb - sa;
    });
  } else {
    out.sort((a, b) => a.rank - b.rank);
  }
  return out;
}

export type CategoryPreset = "all" | "ai" | "defi" | "l1";

export function matchesCategoryPreset(
  preset: CategoryPreset,
  row: TraderScannerRow
): boolean {
  if (preset === "all") return true;
  const blob = [...row.categoryTags, ...row.narrativeTags].join(" ").toLowerCase();
  if (preset === "ai") return blob.includes("ai") || blob.includes("big data");
  if (preset === "defi") return blob.includes("defi");
  if (preset === "l1") return blob.includes("l1") || blob.includes("layer 1");
  return true;
}

export type McapBucket = "all" | "large" | "mid" | "small";

export function matchesMcapBucket(bucket: McapBucket, row: TraderScannerRow): boolean {
  const m = row.marketCapUsd ?? 0;
  if (bucket === "all") return true;
  if (bucket === "large") return m >= 10e9;
  if (bucket === "mid") return m >= 1e9 && m < 10e9;
  if (bucket === "small") return m > 0 && m < 1e9;
  return true;
}

export type MomentumSentimentFilter = "all" | "bull" | "neutral" | "bear";

export function matchesMomentumFilter(
  mode: MomentumSentimentFilter,
  row: TraderScannerRow
): boolean {
  if (mode === "all") return true;
  if (mode === "bull") return row.trendLabel === "Bull";
  if (mode === "bear") return row.trendLabel === "Bear";
  if (mode === "neutral") return row.trendLabel === "Neutral";
  return true;
}

/** Sentiment uses the B70 composite score bucket (not raw 24h/7d momentum). */
export function matchesSentimentFilter(
  mode: MomentumSentimentFilter,
  row: TraderScannerRow
): boolean {
  if (mode === "all") return true;
  if (mode === "bull") return row.sentimentLabel === "Bull";
  if (mode === "bear") return row.sentimentLabel === "Bear";
  if (mode === "neutral") return row.sentimentLabel === "Neutral";
  return true;
}

export type FilterPreset = "gainers" | "losers" | "score" | "trending";

export type ColumnSortKey = "score" | "mcap" | "volume";

export type ColumnSort = {
  key: ColumnSortKey | null;
  dir: "asc" | "desc";
};
