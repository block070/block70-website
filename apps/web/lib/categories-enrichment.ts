import type { CategoryDirectoryApiItem, MarketCategory } from "@/lib/api";

export type TopCoinRow = {
  slug: string;
  name: string;
  symbol: string;
  change24hPct: number;
  block70Score: number;
};

export type DominanceBasis = "global" | "page";

export type EnrichedCategory = MarketCategory & {
  top3: TopCoinRow[];
  avgBlock70: number;
  avgChange24h: number;
  coinCount: number;
  trend: "bullish" | "neutral" | "bearish";
  capitalFlow: "in" | "out" | "neutral";
  volToMcap: number;
  /** Share of denominator market cap, 0–100; null if unknown. */
  dominancePct: number | null;
  /** `global` = vs total crypto mcap from market summary; `page` = vs sum of caps on this directory page only. */
  dominanceBasis: DominanceBasis;
};

/** Map snapshot API row to the shape expected by CategoriesPageClient. */
export function mapCategoryDirectoryToEnriched(row: CategoryDirectoryApiItem): EnrichedCategory {
  const avgCh = row.avg_change_24h;
  return {
    id: row.id,
    name: row.name,
    market_cap: row.market_cap,
    market_cap_change_24h: row.market_cap_change_24h,
    volume_24h: row.volume_24h,
    top_coins: row.top_coins,
    content: row.content,
    top3: row.top3,
    avgBlock70: row.avg_block70,
    avgChange24h: typeof avgCh === "number" && Number.isFinite(avgCh) ? avgCh : Number.NaN,
    coinCount: row.coin_count,
    trend: row.trend,
    capitalFlow: row.capital_flow,
    volToMcap: row.vol_to_mcap,
    dominancePct: null,
    dominanceBasis: "page",
  };
}

/**
 * Fill dominance vs total crypto market cap when `globalTotalMarketcapUsd` is valid;
 * otherwise vs the sum of sector caps on this page (directory slice).
 */
/** Dominance for one sector vs total crypto mcap; no bogus “100%” when global totals are missing. */
export function dominanceForSingleSector(
  sectorMcap: number,
  globalTotalMarketcapUsd: number | null | undefined,
): { dominancePct: number | null; dominanceBasis: DominanceBasis } {
  const m = Math.max(0, sectorMcap);
  const g =
    globalTotalMarketcapUsd != null &&
    typeof globalTotalMarketcapUsd === "number" &&
    Number.isFinite(globalTotalMarketcapUsd) &&
    globalTotalMarketcapUsd > 0
      ? globalTotalMarketcapUsd
      : null;
  if (g != null && m > 0) {
    return { dominancePct: (m / g) * 100, dominanceBasis: "global" };
  }
  return { dominancePct: null, dominanceBasis: "page" };
}

export function applyDominanceToCategories(
  categories: EnrichedCategory[],
  globalTotalMarketcapUsd: number | null | undefined,
): EnrichedCategory[] {
  const useGlobal =
    globalTotalMarketcapUsd != null &&
    typeof globalTotalMarketcapUsd === "number" &&
    Number.isFinite(globalTotalMarketcapUsd) &&
    globalTotalMarketcapUsd > 0;
  const pageSum = categories.reduce((s, c) => s + Math.max(0, c.market_cap ?? 0), 0);
  const denom = useGlobal ? globalTotalMarketcapUsd! : pageSum;
  const basis: DominanceBasis = useGlobal ? "global" : "page";

  if (denom <= 0) {
    return categories.map((c) => ({ ...c, dominancePct: null, dominanceBasis: basis }));
  }

  return categories.map((c) => {
    const m = Math.max(0, c.market_cap ?? 0);
    return {
      ...c,
      dominancePct: (m / denom) * 100,
      dominanceBasis: basis,
    };
  });
}

export function inferSector(id: string, name: string): string {
  const h = `${id} ${name}`.toLowerCase();
  if (/\bai\b|artificial|big.?data|bittensor|agents/.test(h)) return "AI";
  if (/depin|physical|internet-of-things|iot\b|helium|filecoin|akash|render/.test(h)) return "DePIN";
  if (/layer.?1|l1|smart.?contract|proof.?of|pow|pos|bitcoin|ethereum/.test(h)) return "Layer 1 & consensus";
  if (/meme|doge|shib|pepe|frog|4chan/.test(h)) return "Meme";
  if (/defi|dex|lending|yield|amm|perpetual/.test(h)) return "DeFi";
  if (/gaming|metaverse|gamefi|play.?to.?earn/.test(h)) return "Gaming";
  if (/stable|usd|fiat|treasury/.test(h)) return "Stablecoins";
  return "Other";
}

export function mcapBucket(mcap: number): "large" | "mid" | "small" {
  if (mcap >= 100e9) return "large";
  if (mcap >= 10e9) return "mid";
  return "small";
}

export function scoreTrendingCategory(c: EnrichedCategory): number {
  const volScore = Math.log10((c.volume_24h ?? 0) + 1);
  const flow = c.avgChange24h;
  const f = Number.isFinite(flow) ? flow : 0;
  return c.avgBlock70 * 0.55 + volScore * 8 + f * 1.2;
}
