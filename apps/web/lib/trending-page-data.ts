import {
  getCoinsList,
  type CoinListItemDto,
} from "@/lib/coins";
import {
  getCategoryDirectory,
  getMarketCoins,
  getNarrativesList,
  getSignalsTrending,
  getTrendingMarketCoins,
  type CategoryDirectoryApiItem,
  type MarketCoin,
  type MarketNarrativeDto,
  type TrendingMarketCoin,
} from "@/lib/api";
import type { Coin } from "@/lib/crypto-mock";
import { TRENDING_COINS } from "@/lib/crypto-mock";
import {
  applyAttentionOverlay,
  enrichTrendingRows,
  signalHeatBySymbol,
  type EnrichedTrendingRow,
  type TrendTab,
} from "@/lib/trending-metrics";
import { withTimeout } from "@/lib/with-timeout";

const FETCH_TIMEOUT_MS = 10_000;
const MARKET_PAGES = 5;

function mockToCoins(): Coin[] {
  return TRENDING_COINS.map((c, i) => ({
    id: c.slug,
    slug: c.slug,
    symbol: c.symbol,
    name: c.name,
    priceUsd: c.priceUsd,
    marketCapUsd: c.marketCapUsd,
    volume24hUsd: c.volume24hUsd,
    change24hPct: c.change24hPct,
    change7dPct: c.change7dPct,
    rank: i + 1,
    categoryIds: c.categoryIds,
    chainIds: c.chainIds,
    logoUrl: c.logoUrl,
  }));
}

function mergeMarketMaps(chunks: MarketCoin[]): Map<string, MarketCoin> {
  const map = new Map<string, MarketCoin>();
  for (const m of chunks) {
    const k = m.slug?.toLowerCase() ?? "";
    if (k && !map.has(k)) map.set(k, m);
  }
  return map;
}

function trendingToCoins(
  trending: TrendingMarketCoin[],
  marketBySlug: Map<string, MarketCoin>
): Coin[] {
  const btcPriceUsd =
    marketBySlug.get("bitcoin")?.price ??
    marketBySlug.get("btc")?.price ??
    0;

  return trending.map((t, i) => {
    const slug = (t.coingecko_id ?? t.symbol.toLowerCase()).toLowerCase();
    const market = marketBySlug.get(slug);

    if (market) {
      return {
        id: market.slug,
        slug: market.slug,
        symbol: market.symbol,
        name: market.name,
        priceUsd: market.price ?? 0,
        marketCapUsd: market.market_cap ?? 0,
        volume24hUsd: market.volume ?? 0,
        change24hPct: market.change_24h ?? Number.NaN,
        change7dPct: market.change_7d ?? Number.NaN,
        rank: t.rank ?? i + 1,
        categoryIds: [],
        chainIds: [],
        logoUrl: market.logo_url ?? t.image ?? undefined,
      };
    }

    const priceUsd =
      t.price != null && btcPriceUsd > 0 ? t.price * btcPriceUsd : 0;

    return {
      id: slug,
      slug,
      symbol: t.symbol,
      name: t.name,
      priceUsd,
      marketCapUsd: 0,
      volume24hUsd: 0,
      change24hPct: Number.NaN,
      change7dPct: Number.NaN,
      rank: t.rank ?? i + 1,
      categoryIds: [],
      chainIds: [],
      logoUrl: t.image ?? undefined,
    };
  });
}

function categoryBySlugFromList(items: CoinListItemDto[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const row of items) {
    const slug = row.coin.slug?.toLowerCase();
    if (!slug) continue;
    if (!map.has(slug)) {
      map.set(slug, row.coin.category ?? null);
    }
  }
  return map;
}

export type TrendingOpportunity = {
  slug: string;
  name: string;
  symbol: string;
  logoUrl?: string | null;
  change24hPct: number;
  trendingScore: number;
  attentionScore: number;
  block70Score: number;
  blendScore: number;
};

export type TrendingHoursWindow = 1 | 6 | 24;

export type TrendingPagePayload = {
  rows: EnrichedTrendingRow[];
  opportunities: TrendingOpportunity[];
  updatedAt: string;
  isFallback: boolean;
  hours: TrendingHoursWindow;
  narratives: MarketNarrativeDto[];
  categories: CategoryDirectoryApiItem[];
};

function normalizeTrendingHours(raw?: number): TrendingHoursWindow {
  if (raw === 1 || raw === 6 || raw === 24) return raw;
  return 24;
}

function opportunityBlend(r: EnrichedTrendingRow): number {
  return r.attentionScore * 0.45 + r.block70Score * 0.55;
}

export async function getTrendingPagePayload(
  hoursParam?: number,
): Promise<TrendingPagePayload> {
  const hours = normalizeTrendingHours(hoursParam);
  const updatedAt = new Date().toISOString();

  try {
    let coins: Coin[];
    let coingeckoScores: (number | null)[];

    const [trending, marketSettled, signalTrending, narrativesRes, categoriesRes] =
      await Promise.all([
        withTimeout(getTrendingMarketCoins(40), FETCH_TIMEOUT_MS),
        Promise.allSettled(
          Array.from({ length: MARKET_PAGES }, (_, p) =>
            withTimeout(getMarketCoins({ limit: 100, page: p + 1 }), FETCH_TIMEOUT_MS),
          ),
        ),
        withTimeout(getSignalsTrending({ hours, limit: 80 }), FETCH_TIMEOUT_MS).catch(() => []),
        withTimeout(getNarrativesList({ limit: 40 }), FETCH_TIMEOUT_MS).catch(() => []),
        withTimeout(getCategoryDirectory({ limit: 24, order: "market_cap" }), FETCH_TIMEOUT_MS).catch(
          () => ({ items: [], total: 0 }),
        ),
      ]);

    const narratives: MarketNarrativeDto[] = Array.isArray(narrativesRes) ? narrativesRes : [];
    const categories: CategoryDirectoryApiItem[] = categoriesRes.items ?? [];

    const flatMarket: MarketCoin[] = marketSettled.flatMap((r) =>
      r.status === "fulfilled" ? r.value : []
    );
    const marketBySlug = mergeMarketMaps(flatMarket);

    let listRows: CoinListItemDto[] = [];
    try {
      listRows = await withTimeout(getCoinsList({ limit: 500, page: 1 }), FETCH_TIMEOUT_MS);
    } catch {
      listRows = [];
    }
    const catMap = categoryBySlugFromList(listRows);

    if (trending.length > 0) {
      coins = trendingToCoins(trending, marketBySlug);
      coingeckoScores = trending.map((t) => t.score ?? null);
    } else {
      throw new Error("Trending API returned empty");
    }

    const categoryLabels = coins.map(
      (c) => catMap.get(c.slug.toLowerCase()) ?? null
    );

    const baseRows = enrichTrendingRows(coins, {
      coingeckoScores,
      categoryLabels,
    });
    const heatMap = signalHeatBySymbol(signalTrending);
    const rows = applyAttentionOverlay(baseRows, {
      signalHeatBySymbol: heatMap,
      narratives,
      categoryLabels,
    }).sort((a, b) => b.attentionScore - a.attentionScore);

    const opportunities = [...rows]
      .sort((a, b) => opportunityBlend(b) - opportunityBlend(a))
      .slice(0, 5)
      .map((r) => ({
        slug: r.coin.slug,
        name: r.coin.name,
        symbol: r.coin.symbol,
        logoUrl: r.coin.logoUrl,
        change24hPct: r.coin.change24hPct,
        trendingScore: r.trendingScore,
        attentionScore: r.attentionScore,
        block70Score: r.block70Score,
        blendScore: opportunityBlend(r),
      }));

    return {
      rows,
      opportunities,
      updatedAt,
      isFallback: false,
      hours,
      narratives,
      categories,
    };
  } catch {
    const coins = mockToCoins();
    const coingeckoScores = coins.map(() => null);
    const categoryLabels = coins.map((c) => c.categoryIds?.[0] ?? null);
    const baseRows = enrichTrendingRows(coins, {
      coingeckoScores,
      categoryLabels,
    });
    const rows = applyAttentionOverlay(baseRows, {
      signalHeatBySymbol: new Map(),
      narratives: [],
      categoryLabels,
    }).sort((a, b) => b.attentionScore - a.attentionScore);
    const opportunities = [...rows]
      .sort((a, b) => opportunityBlend(b) - opportunityBlend(a))
      .slice(0, 5)
      .map((r) => ({
        slug: r.coin.slug,
        name: r.coin.name,
        symbol: r.coin.symbol,
        logoUrl: r.coin.logoUrl,
        change24hPct: r.coin.change24hPct,
        trendingScore: r.trendingScore,
        attentionScore: r.attentionScore,
        block70Score: r.block70Score,
        blendScore: opportunityBlend(r),
      }));
    return {
      rows,
      opportunities,
      updatedAt,
      isFallback: true,
      hours,
      narratives: [],
      categories: [],
    };
  }
}

export function filterRowsByTab(rows: EnrichedTrendingRow[], tab: TrendTab): EnrichedTrendingRow[] {
  if (tab === "all") return rows;
  return rows.filter((r) => r.trendTab === tab);
}
