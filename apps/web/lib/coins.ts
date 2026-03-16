import { API_BASE_URL, fetchJson } from "./api";
import { COINS, COIN_PRICES } from "./crypto-mock";

export type CoinInfoDto = {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  twitter: string | null;
  discord: string | null;
  chain: string | null;
  category: string | null;
  market_cap: number | null;
  price: number | null;
  volume_24h: number | null;
  circulating_supply: number | null;
  total_supply: number | null;
};

export type MarketDataPointDto = {
  timestamp: string;
  price: number;
  market_cap: number | null;
  volume_24h: number | null;
  price_change_24h: number | null;
  price_change_7d: number | null;
};

export type NarrativeDto = {
  name: string;
  description: string | null;
  confidence_score: number;
};

export type NewsArticleDto = {
  title: string;
  source: string;
  url: string;
  summary: string | null;
  published_at: string | null;
};

export type CoinDetailDto = {
  coin: CoinInfoDto;
  market_data: MarketDataPointDto[];
  narratives: NarrativeDto[];
  news: NewsArticleDto[];
};

export async function getCoinBySlug(slug: string): Promise<CoinDetailDto> {
  return fetchJson<CoinDetailDto>(`/api/v1/coins/${encodeURIComponent(slug)}`);
}

/** Resolve slug or symbol to mock coin (e.g. "sol" -> Solana). Used when API 404s. */
function getMockCoinBySlugOrSymbol(slug: string): typeof COINS[0] | null {
  const lower = slug.toLowerCase();
  return (
    COINS.find((c) => c.slug === lower || c.symbol.toLowerCase() === lower) ??
    null
  );
}

/** Return mock coin detail for a slug/symbol when the API has no data. */
export function getMockCoinDetail(slug: string): CoinDetailDto | null {
  const coin = getMockCoinBySlugOrSymbol(slug);
  if (!coin) return null;
  const points = COIN_PRICES[coin.slug as keyof typeof COIN_PRICES];
  const market_data: MarketDataPointDto[] = Array.isArray(points)
    ? points.map((p) => ({
        timestamp: p.timestamp,
        price: p.priceUsd,
        market_cap: null,
        volume_24h: null,
        price_change_24h: null,
        price_change_7d: null,
      }))
    : [];
  return {
    coin: {
      id: 0,
      name: coin.name,
      symbol: coin.symbol,
      slug: coin.slug,
      description: null,
      logo_url: null,
      website: null,
      twitter: null,
      discord: null,
      chain: coin.chainIds[0] ?? null,
      category: coin.categoryIds[0] ?? null,
      market_cap: coin.marketCapUsd,
      price: coin.priceUsd,
      volume_24h: coin.volume24hUsd,
      circulating_supply: null,
      total_supply: null,
    },
    market_data,
    narratives: [],
    news: [],
  };
}

/** Fetch coin by slug from API; on 404 use mock data so SOL, BTC, etc. always work. */
export async function getCoinBySlugOrMock(slug: string): Promise<CoinDetailDto> {
  try {
    return await getCoinBySlug(slug);
  } catch {
    const mock = getMockCoinDetail(slug);
    if (mock) return mock;
    throw new Error("Coin not found");
  }
}

export type CoinListItemDto = {
  coin: CoinInfoDto;
  latest_market_data: MarketDataPointDto | null;
};

export async function getCoinsList(params?: {
  category?: string;
  limit?: number;
}): Promise<CoinListItemDto[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<CoinListItemDto[]>(`/api/v1/coins${query ? `?${query}` : ""}`);
}

