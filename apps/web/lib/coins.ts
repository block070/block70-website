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
  whitepaper_url: string | null;
  explorer_url: string | null;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  chain: string | null;
  category: string | null;
  market_cap_rank: number | null;
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

const MOCK_LINKS: Record<string, { website?: string; whitepaper?: string; explorer?: string; twitter?: string }> = {
  bitcoin: { website: "https://bitcoin.org", whitepaper: "https://bitcoin.org/bitcoin.pdf", explorer: "https://mempool.space/", twitter: "bitcoin" },
  ethereum: { website: "https://ethereum.org", whitepaper: "https://ethereum.org/en/whitepaper/", explorer: "https://etherscan.io/", twitter: "ethereum" },
  solana: { website: "https://solana.com", whitepaper: "https://solana.com/solana-whitepaper.pdf", explorer: "https://solscan.io/", twitter: "solana" },
  chainlink: { website: "https://chain.link", explorer: "https://etherscan.io/", twitter: "chainlink" },
  avalanche: { website: "https://avax.network", explorer: "https://snowtrace.io/", twitter: "avalancheavax" },
  dogecoin: { website: "https://dogecoin.com", explorer: "https://dogechain.info/", twitter: "dogecoin" },
  uniswap: { website: "https://uniswap.org", whitepaper: "https://uniswap.org/whitepaper.pdf", explorer: "https://etherscan.io/", twitter: "Uniswap" },
  cosmos: { website: "https://cosmos.network", whitepaper: "https://cosmos.network/resources/whitepaper", explorer: "https://mintscan.io/cosmos/", twitter: "cosmos" },
};

/** Return mock coin detail for a slug/symbol when the API has no data. */
export function getMockCoinDetail(slug: string): CoinDetailDto | null {
  const coin = getMockCoinBySlugOrSymbol(slug);
  if (!coin) return null;
  const points = COIN_PRICES[coin.slug as keyof typeof COIN_PRICES];
  const links = MOCK_LINKS[coin.slug as keyof typeof MOCK_LINKS];
  const market_data: MarketDataPointDto[] = Array.isArray(points)
    ? points.map((p) => ({
        timestamp: p.timestamp,
        price: p.priceUsd,
        market_cap: null,
        volume_24h: null,
        price_change_24h: coin.change24hPct,
        price_change_7d: coin.change7dPct,
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
      market_cap_rank: coin.rank,
      website: links?.website ?? null,
      whitepaper_url: links?.whitepaper ?? null,
      explorer_url: links?.explorer ?? null,
      twitter: links?.twitter ?? null,
      discord: null,
      telegram: null,
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

export type ChartPricePoint = [number, number]; // [timestamp_ms, price]

export async function getCoinChartData(
  slug: string,
  days: number
): Promise<ChartPricePoint[]> {
  const daysParam = days > 365 ? "max" : String(days);
  const res = await fetch(
    `/api/coins/${encodeURIComponent(slug)}/chart?days=${daysParam}`,
    { cache: "no-store" }
  );
  const data = (await res.json()) as { prices?: ChartPricePoint[]; error?: string };
  if (!res.ok) throw new Error(data.error || "Chart data unavailable");
  return data.prices ?? [];
}

export const COINS_PER_PAGE = 100;
export const TOTAL_COINS_PAGINATED = 2000;
export const TOTAL_PAGES = TOTAL_COINS_PAGINATED / COINS_PER_PAGE; // 20

export async function getCoinsList(params?: {
  category?: string;
  category_slug?: string;
  limit?: number;
  page?: number;
}): Promise<CoinListItemDto[]> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.category_slug) search.set("category_slug", params.category_slug);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.page != null && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return fetchJson<CoinListItemDto[]>(`/api/v1/coins${query ? `?${query}` : ""}`);
}

