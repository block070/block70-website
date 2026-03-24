import type { MarketCategory } from "@/lib/api";
import type { CoinListItemDto } from "@/lib/coins";
import { getCoinsList } from "@/lib/coins";
import { computeBlock70Score } from "@/lib/coins-scanner";
import type { Coin } from "@/lib/crypto-mock";
import { withTimeout } from "@/lib/with-timeout";

export type TopCoinRow = {
  slug: string;
  name: string;
  symbol: string;
  change24hPct: number;
  block70Score: number;
};

export type EnrichedCategory = MarketCategory & {
  top3: TopCoinRow[];
  avgBlock70: number;
  avgChange24h: number;
  coinCount: number;
  trend: "bullish" | "neutral" | "bearish";
  capitalFlow: "in" | "out" | "neutral";
  volToMcap: number;
};

export function listItemToCoin(item: CoinListItemDto): Coin {
  const md = item.latest_market_data;
  return {
    id: String(item.coin.id),
    slug: item.coin.slug,
    symbol: item.coin.symbol,
    name: item.coin.name,
    priceUsd: item.coin.price ?? md?.price ?? 0,
    marketCapUsd: item.coin.market_cap ?? md?.market_cap ?? 0,
    volume24hUsd: item.coin.volume_24h ?? md?.volume_24h ?? 0,
    change24hPct: md?.price_change_24h ?? Number.NaN,
    change7dPct: md?.price_change_7d ?? Number.NaN,
    rank: item.coin.market_cap_rank ?? 0,
    categoryIds: item.coin.category ? [item.coin.category] : [],
    chainIds: item.coin.chain ? [item.coin.chain] : [],
    logoUrl: item.coin.logo_url ?? undefined,
  };
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

export function categorySectorTrend(
  avgChange24h: number,
  volToMcap: number,
  marketCapChange24h?: number | null
): "bullish" | "neutral" | "bearish" {
  const p = Number.isFinite(avgChange24h) ? avgChange24h : 0;
  const sector = typeof marketCapChange24h === "number" && Number.isFinite(marketCapChange24h) ? marketCapChange24h : 0;
  const liquidityHeat = volToMcap > 0.08 ? 1.2 : volToMcap > 0.03 ? 0.4 : -0.2;
  const score = p * 0.45 + sector * 0.25 + liquidityHeat;
  if (score > 0.35) return "bullish";
  if (score < -0.35) return "bearish";
  return "neutral";
}

export function categoryCapitalFlow(
  marketCapChange24h?: number | null,
  avgChange24h: number = 0
): "in" | "out" | "neutral" {
  const s = typeof marketCapChange24h === "number" && Number.isFinite(marketCapChange24h) ? marketCapChange24h : 0;
  const a = Number.isFinite(avgChange24h) ? avgChange24h : 0;
  if (s > 0.25 && a >= -2) return "in";
  if (s < -0.25 && a <= 2) return "out";
  return "neutral";
}

async function enrichOneCategory(cat: MarketCategory, timeoutMs: number): Promise<EnrichedCategory> {
  const mcap = Math.max(1, cat.market_cap ?? 1);
  const vol = cat.volume_24h ?? 0;
  const volToMcap = vol / mcap;

  let top3: TopCoinRow[] = [];
  let avgBlock70 = 0;
  let avgChange24h = Number.NaN;
  let coinCount = 0;

  try {
    const items = await withTimeout(
      getCoinsList({ category_slug: cat.id, limit: 40, page: 1 }),
      timeoutMs,
      [] as CoinListItemDto[]
    );
    coinCount = items.length >= 40 ? 40 : items.length;
    const withScores = items.map((row) => {
      const c = listItemToCoin(row);
      const block70Score = computeBlock70Score(c);
      return { c, block70Score };
    });
    withScores.sort((a, b) => b.block70Score - a.block70Score);
    top3 = withScores.slice(0, 3).map(({ c, block70Score }) => ({
      slug: c.slug,
      name: c.name,
      symbol: c.symbol,
      change24hPct: typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct) ? c.change24hPct : 0,
      block70Score,
    }));
    if (withScores.length) {
      avgBlock70 = Math.round(
        withScores.reduce((s, x) => s + x.block70Score, 0) / withScores.length
      );
      const changes = withScores
        .map((x) => x.c.change24hPct)
        .filter((x) => typeof x === "number" && Number.isFinite(x)) as number[];
      avgChange24h = changes.length
        ? changes.reduce((a, b) => a + b, 0) / changes.length
        : Number.NaN;
    }
  } catch {
    /* use top_coins from category without scores */
  }

  if (top3.length === 0 && Array.isArray(cat.top_coins) && cat.top_coins.length > 0) {
    top3 = cat.top_coins.slice(0, 3).map((t) => ({
      slug: t.slug,
      name: t.symbol || t.slug,
      symbol: t.symbol,
      change24hPct: Number.NaN,
      block70Score: 50,
    }));
    avgBlock70 = 50;
    avgChange24h = typeof cat.market_cap_change_24h === "number" ? cat.market_cap_change_24h : Number.NaN;
    coinCount = cat.top_coins.length;
  }

  const trend = categorySectorTrend(
    avgChange24h,
    volToMcap,
    cat.market_cap_change_24h
  );
  const capitalFlow = categoryCapitalFlow(cat.market_cap_change_24h, avgChange24h);

  return {
    ...cat,
    top3,
    avgBlock70,
    avgChange24h,
    coinCount,
    trend,
    capitalFlow,
    volToMcap,
  };
}

export async function enrichCategoriesBatch(
  categories: MarketCategory[],
  options?: { concurrency?: number; timeoutMs?: number }
): Promise<EnrichedCategory[]> {
  const concurrency = options?.concurrency ?? 6;
  const timeoutMs = options?.timeoutMs ?? 4500;
  const out: EnrichedCategory[] = [];
  for (let i = 0; i < categories.length; i += concurrency) {
    const chunk = categories.slice(i, i + concurrency);
    const part = await Promise.all(chunk.map((c) => enrichOneCategory(c, timeoutMs)));
    out.push(...part);
  }
  return out;
}

export function scoreTrendingCategory(c: EnrichedCategory): number {
  const volScore = Math.log10((c.volume_24h ?? 0) + 1);
  const flow = c.avgChange24h;
  const f = Number.isFinite(flow) ? flow : 0;
  return c.avgBlock70 * 0.55 + volScore * 8 + f * 1.2;
}
