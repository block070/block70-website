import type {
  AlphaEvent,
  AlphaRankedOpportunity,
  CandidateProject,
  NarrativeTokenGroup,
  Opportunity,
  OpportunityFilter,
  RadarEventDto,
  SignalDto,
  TrendingSignalTokenDto,
  WalletLeaderboardEntry,
} from "./types";

// Server (SSR): use API_SERVER_URL in Docker so the Next.js container can reach the API.
// Client (browser): use NEXT_PUBLIC_API_BASE_URL.
// Node fetch requires absolute URLs; relative paths fail with "Invalid URL".
export function getApiBaseUrl(): string {
  const url =
    process.env.API_SERVER_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";
  if (url) return url.replace(/\/$/, "");
  if (typeof window !== "undefined") return "";
  const protocol = process.env.VERCEL ? "https" : "http";
  const host =
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    (typeof process.env.NEXT_PUBLIC_SITE_URL === "string"
      ? process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")
      : "") ||
    "localhost:3000";
  return `${protocol}://${host}`;
}

export const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
    : process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = base ? `${base}${path.startsWith("/") ? "" : "/"}${path}` : path;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API request failed with status ${res.status}`);
  }

  return (await res.json()) as T;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(
  xml: string,
  source: string,
  startId: number,
  maxItems: number,
): NewsArticleSummary[] {
  const items: NewsArticleSummary[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRegex) ?? [];
  for (const block of blocks) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim();
    const description = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1]?.trim();
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    if (!title || !link) continue;
    items.push({
      id: startId + items.length,
      title: stripHtmlTags(decodeHtmlEntities(title)),
      source,
      url: decodeHtmlEntities(link),
      summary: description ? stripHtmlTags(decodeHtmlEntities(description)) : null,
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
    });
    if (items.length >= maxItems) break;
  }
  return items;
}

async function getDirectRssFallback(limit = 50): Promise<NewsArticleSummary[]> {
  const feeds = [
    { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml" },
    { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
    { source: "Decrypt", url: "https://decrypt.co/feed" },
  ];

  const results = await Promise.allSettled(
    feeds.map(async (feed, idx) => {
      const res = await fetch(feed.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`rss fetch failed: ${feed.source}`);
      const xml = await res.text();
      return parseRssItems(xml, feed.source, (idx + 1) * 10000, Math.max(5, Math.ceil(limit / 2)));
    }),
  );

  const merged = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return merged
    .sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

export async function getOpportunities(
  params?: OpportunityFilter,
): Promise<Opportunity[]> {
  const search = new URLSearchParams();

  if (params?.type) search.set("type", params.type);
  if (params?.chain) search.set("chain", params.chain);
  if (typeof params?.min_score === "number") {
    search.set("min_score", String(params.min_score));
  }

  const query = search.toString();
  const path = `/api/v1/opportunities${query ? `?${query}` : ""}`;

  return fetchJson<Opportunity[]>(path);
}

export async function getOpportunityById(id: number): Promise<Opportunity> {
  const path = `/api/v1/opportunities/${id}`;
  return fetchJson<Opportunity>(path);
}

export async function getOpportunityBySlug(slug: string): Promise<Opportunity> {
  const path = `/api/v1/opportunities/slug/${encodeURIComponent(slug)}`;
  return fetchJson<Opportunity>(path);
}

export async function getInsightsTop(): Promise<{
  generated_at: string;
  arbitrage: Opportunity[];
  mining: Opportunity[];
  wallet: Opportunity[];
}> {
  return fetchJson("/api/v1/insights/top");
}

export async function getInsightsTrending(): Promise<{
  trends: {
    category: string;
    key: string;
    magnitude: number;
    details: Record<string, unknown>;
    timestamp: string;
  }[];
}> {
  return fetchJson("/api/v1/insights/trending");
}

export async function getInsightsHighestRoi(): Promise<Opportunity[]> {
  return fetchJson<Opportunity[]>("/api/v1/insights/highest-roi");
}

export async function getWalletLeaderboard(
  init?: RequestInit,
): Promise<WalletLeaderboardEntry[]> {
  return fetchJson<WalletLeaderboardEntry[]>(
    "/api/v1/wallets/leaderboard",
    init,
  );
}

export type NewsArticleSummary = {
  id: number;
  source_type?: string;
  title: string;
  source: string;
  url: string;
  author?: string | null;
  summary?: string | null;
  body_text?: string | null;
  image_url?: string | null;
  tags?: string[];
  tickers?: string[];
  entities?: Array<Record<string, unknown>>;
  source_count?: number;
  dedupe_count?: number;
  rank_explanation?: Record<string, unknown>;
  homepage_score?: number | null;
  coin_scores?: Record<string, number>;
  published_at?: string | null;
};

function sanitizeNewsItems(items: NewsArticleSummary[]): NewsArticleSummary[] {
  return items
    .map((item) => {
      const title = (item.title ?? "").replace(/\]\]>/g, "").trim();
      const url = (item.url ?? "").trim();
      const summary = (item.summary ?? "")
        .replace(/\]\]>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return {
        ...item,
        title,
        url,
        summary: summary || null,
      };
    })
    .filter((item) => item.title.length > 0 && item.url.length > 0);
}

export type MarketCoin = {
  name: string;
  symbol: string;
  price: number | null;
  change_24h: number | null;
  change_7d: number | null;
  market_cap: number | null;
  volume: number | null;
  slug: string;
  logo_url?: string | null;
};

export async function getMarketCoins(params?: {
  limit?: number;
  page?: number;
  light?: boolean;
}): Promise<MarketCoin[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.light) search.set("light", "1");
  const query = search.toString();
  return fetchJson<MarketCoin[]>(`/api/v1/market/coins${query ? `?${query}` : ""}`);
}

/** GET /api/v1/market/summary — global totals + optional top slice (single source for home/coins stats). */
export type MarketGlobalSummary = {
  total_market_cap_usd: number | null;
  total_volume_usd: number | null;
  btc_dominance_pct: number | null;
  eth_dominance_pct: number | null;
};

export type MarketSummaryResponse = {
  schema_version: number;
  as_of: string;
  source: string;
  global: MarketGlobalSummary;
  top: MarketCoin[];
};

export async function getMarketSummary(top = 30): Promise<MarketSummaryResponse> {
  const search = new URLSearchParams({ top: String(top) });
  return fetchJson<MarketSummaryResponse>(`/api/v1/market/summary?${search}`);
}

export type TrendingMarketCoin = {
  name: string;
  symbol: string;
  rank: number;
  price: number | null;
  image: string | null;
  coingecko_id: string | null;
  score: number | null;
};

export async function getTrendingMarketCoins(
  limit = 20,
): Promise<TrendingMarketCoin[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetchJson<TrendingMarketCoin[]>(
    `/api/v1/market/trending?${search.toString()}`,
  );
}

export type MarketCategory = {
  id: string;
  name: string;
  market_cap: number;
  market_cap_change_24h?: number | null;
  volume_24h: number;
  top_3_coins?: string[];
  top_3_coins_id?: string[];
  top_coins?: { slug: string; symbol: string }[];
  content?: string | null;
};

const FALLBACK_CATEGORIES: MarketCategory[] = [
  { id: "defi", name: "DeFi Bluechips", market_cap: 25_000_000_000, volume_24h: 1_200_000_000, market_cap_change_24h: null, top_coins: [{ slug: "uniswap", symbol: "UNI" }, { slug: "aave", symbol: "AAVE" }, { slug: "curve-dao-token", symbol: "CRV" }] },
  { id: "l1", name: "Layer 1s", market_cap: 450_000_000_000, volume_24h: 22_000_000_000, market_cap_change_24h: null, top_coins: [{ slug: "ethereum", symbol: "ETH" }, { slug: "solana", symbol: "SOL" }, { slug: "avalanche-2", symbol: "AVAX" }] },
  { id: "infra", name: "Infrastructure", market_cap: 12_000_000_000, volume_24h: 600_000_000, market_cap_change_24h: null, top_coins: [{ slug: "chainlink", symbol: "LINK" }, { slug: "the-graph", symbol: "GRT" }] },
  { id: "store-of-value", name: "Store of Value", market_cap: 1_400_000_000_000, volume_24h: 28_000_000_000, market_cap_change_24h: null, top_coins: [{ slug: "bitcoin", symbol: "BTC" }] },
  { id: "meme-token", name: "Meme Coins", market_cap: 80_000_000_000, volume_24h: 8_000_000_000, market_cap_change_24h: null, top_coins: [{ slug: "dogecoin", symbol: "DOGE" }, { slug: "shiba-inu", symbol: "SHIB" }] },
  { id: "ai-big-data", name: "AI & Big Data", market_cap: 35_000_000_000, volume_24h: 2_500_000_000, market_cap_change_24h: null, top_coins: [{ slug: "fetch-ai", symbol: "FET" }, { slug: "render-token", symbol: "RNDR" }, { slug: "ocean-protocol", symbol: "OCEAN" }] },
];

/** Pre-enriched rows from GET /api/v1/categories (snapshot-backed; no per-category CG). */
export type CategoryDirectoryApiItem = {
  id: string;
  name: string;
  market_cap: number;
  market_cap_change_24h?: number | null;
  volume_24h: number;
  top_coins?: { slug: string; symbol: string }[];
  content?: string | null;
  avg_block70: number;
  avg_change_24h?: number | null;
  coin_count: number;
  trend: "bullish" | "neutral" | "bearish";
  capital_flow: "in" | "out" | "neutral";
  vol_to_mcap: number;
  top3: {
    slug: string;
    name: string;
    symbol: string;
    change24hPct: number;
    block70Score: number;
  }[];
};

export async function getCategoryDirectory(params?: {
  order?: string;
  limit?: number;
  page?: number;
}): Promise<{ items: CategoryDirectoryApiItem[]; total: number }> {
  const search = new URLSearchParams();
  if (params?.order) search.set("order", params.order);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.page != null && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return fetchJson<{ items: CategoryDirectoryApiItem[]; total: number }>(
    `/api/v1/categories${query ? `?${query}` : ""}`,
  );
}

export async function getMarketCategories(params?: {
  order?: string;
  limit?: number;
  page?: number;
}): Promise<{ items: MarketCategory[]; total: number }> {
  try {
    const search = new URLSearchParams();
    if (params?.order) search.set("order", params.order);
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.page != null && params.page > 1) search.set("page", String(params.page));
    const query = search.toString();
    const data = await fetchJson<{ items?: MarketCategory[]; total?: number } | MarketCategory[]>(
      `/api/v1/market/categories${query ? `?${query}` : ""}`
    );
    if (data && typeof data === "object" && "items" in data && Array.isArray(data.items) && data.items.length > 0) {
      return { items: data.items, total: data.total ?? data.items.length };
    }
    const fallback = Array.isArray(data) ? data : [];
    if (fallback.length > 0) return { items: fallback, total: fallback.length };
  } catch {
    // API failed: use fallback so categories page always has content
  }
  const limit = params?.limit ?? 100;
  const page = params?.page ?? 1;
  const start = (page - 1) * limit;
  const items = FALLBACK_CATEGORIES.slice(start, start + limit);
  return { items, total: FALLBACK_CATEGORIES.length };
}

export async function getNewsArticles(params?: {
  limit?: number;
}): Promise<NewsArticleSummary[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  const query = search.toString();
  try {
    const result = await fetchJson<{ items: NewsArticleSummary[] }>(
      `/api/news/trending${query ? `?${query}` : ""}`,
    );
    return sanitizeNewsItems(result.items ?? []);
  } catch {
    try {
      // Fallback to legacy endpoint so homepage/news stay available during backend migration hiccups.
      const legacy = await fetchJson<NewsArticleSummary[]>(
        `/api/v1/articles${query ? `?${query}` : ""}`,
      );
      return sanitizeNewsItems(legacy);
    } catch {
      return sanitizeNewsItems(await getDirectRssFallback(params?.limit ?? 20));
    }
  }
}

export async function getLatestNews(params?: {
  limit?: number;
}): Promise<NewsArticleSummary[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  const query = search.toString();
  try {
    const result = await fetchJson<{ items: NewsArticleSummary[] }>(
      `/api/news/latest${query ? `?${query}` : ""}`,
    );
    return sanitizeNewsItems(result.items ?? []);
  } catch {
    try {
      const legacy = await fetchJson<NewsArticleSummary[]>(
        `/api/v1/articles${query ? `?${query}` : ""}`,
      );
      return sanitizeNewsItems(legacy);
    } catch {
      return sanitizeNewsItems(await getDirectRssFallback(params?.limit ?? 50));
    }
  }
}

export async function getNewsForCoin(
  symbol: string,
  params?: { limit?: number },
): Promise<NewsArticleSummary[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  const query = search.toString();
  try {
    const result = await fetchJson<{ items: NewsArticleSummary[] }>(
      `/api/news/coin/${encodeURIComponent(symbol)}${query ? `?${query}` : ""}`,
    );
    return sanitizeNewsItems(result.items ?? []);
  } catch {
    // Coin endpoint may be unavailable; caller can use existing coin detail fallback data.
    return [];
  }
}

export type CapitalFlowDto = {
  id: number;
  source_asset: string;
  destination_asset: string;
  amount: number;
  chain: string;
  timestamp: string | null;
};

export type CapitalFlowTrendingDto = {
  source_asset: string;
  destination_asset: string;
  chain: string;
  total_amount: number;
  flow_count: number;
};

export async function getFlows(params?: {
  chain?: string;
  hours?: number;
  limit?: number;
}): Promise<CapitalFlowDto[]> {
  const search = new URLSearchParams();
  if (params?.chain) search.set("chain", params.chain);
  if (params?.hours != null) search.set("hours", String(params.hours));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<CapitalFlowDto[]>(`/api/v1/flows${query ? `?${query}` : ""}`);
}

export async function getFlowsTrending(params?: {
  hours?: number;
  limit?: number;
}): Promise<CapitalFlowTrendingDto[]> {
  const search = new URLSearchParams();
  if (params?.hours != null) search.set("hours", String(params.hours));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<CapitalFlowTrendingDto[]>(
    `/api/v1/flows/trending${query ? `?${query}` : ""}`,
  );
}

export async function getFlowsForToken(
  token: string,
  params?: { hours?: number; limit?: number },
): Promise<CapitalFlowDto[]> {
  const search = new URLSearchParams();
  if (params?.hours != null) search.set("hours", String(params.hours));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<CapitalFlowDto[]>(
    `/api/v1/flows/${encodeURIComponent(token)}${query ? `?${query}` : ""}`,
  );
}

export type SmartWalletDto = {
  id?: number;
  wallet_address: string;
  chain: string;
  reputation_score: number;
  profitability_score: number;
  created_at?: string | null;
};

export async function getSmartWallets(params?: {
  chain?: string;
  limit?: number;
}): Promise<SmartWalletDto[]> {
  const search = new URLSearchParams();
  if (params?.chain) search.set("chain", params.chain);
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<SmartWalletDto[]>(
    `/api/v1/wallets/smart${query ? `?${query}` : ""}`,
  );
}

export async function getWalletByAddress(
  address: string,
): Promise<Record<string, unknown>> {
  return fetchJson<Record<string, unknown>>(
    `/api/v1/wallets/${encodeURIComponent(address)}`,
  );
}

export async function getWalletPerformance(address: string): Promise<{
  wallet_address: string;
  chain: string;
  roi: number;
  win_rate: number;
  token_holdings: { symbol: string; balance: number }[];
}> {
  return fetchJson(
    `/api/v1/wallets/${encodeURIComponent(address)}/performance`,
  );
}

export async function getRadarList(params?: {
  hours?: number;
  min_event_score?: number;
}): Promise<RadarEventDto[]> {
  const search = new URLSearchParams();
  if (params?.hours != null) search.set("hours", String(params.hours));
  if (params?.min_event_score != null)
    search.set("min_event_score", String(params.min_event_score));
  const query = search.toString();
  return fetchJson<RadarEventDto[]>(
    `/api/v1/radar${query ? `?${query}` : ""}`,
  );
}

export type MarketNarrativeDto = {
  id: number;
  name: string;
  description: string | null;
  trend_score: number;
  created_at: string | null;
};

export async function getNarrativesList(params?: {
  limit?: number;
}): Promise<MarketNarrativeDto[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<MarketNarrativeDto[]>(
    `/api/v1/narratives${query ? `?${query}` : ""}`,
  );
}

export type MarketOpportunityDto = {
  id: number;
  token_symbol: string;
  opportunity_type: string;
  alpha_score: number;
  confidence_score: number;
  created_at: string | null;
};

export async function getOpportunitiesTop(params?: {
  limit?: number;
  min_alpha?: number;
  min_confidence?: number;
}): Promise<MarketOpportunityDto[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.min_alpha != null) search.set("min_alpha", String(params.min_alpha));
  if (params?.min_confidence != null)
    search.set("min_confidence", String(params.min_confidence));
  const query = search.toString();
  return fetchJson<MarketOpportunityDto[]>(
    `/api/v1/opportunities/top${query ? `?${query}` : ""}`,
  );
}

export type AIInsightDto = {
  id: number;
  insight_type: string;
  title: string;
  summary: string | null;
  related_tokens: string[];
  confidence_score: number;
  created_at: string | null;
};

export async function getAIInsights(params?: {
  insight_type?: string;
  limit?: number;
  offset?: number;
}): Promise<AIInsightDto[]> {
  const search = new URLSearchParams();
  if (params?.insight_type) search.set("insight_type", params.insight_type);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const query = search.toString();
  return fetchJson<AIInsightDto[]>(
    `/api/v1/ai/insights${query ? `?${query}` : ""}`,
  );
}

export async function getAIInsightsLatest(
  limit?: number,
): Promise<AIInsightDto[]> {
  const search = new URLSearchParams();
  if (limit != null) search.set("limit", String(limit));
  const query = search.toString();
  return fetchJson<AIInsightDto[]>(
    `/api/v1/ai/insights/latest${query ? `?${query}` : ""}`,
  );
}

export async function getAIInsightsTop(params?: {
  limit?: number;
  min_confidence?: number;
}): Promise<AIInsightDto[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.min_confidence != null)
    search.set("min_confidence", String(params.min_confidence));
  const query = search.toString();
  return fetchJson<AIInsightDto[]>(
    `/api/v1/ai/insights/top${query ? `?${query}` : ""}`,
  );
}

export async function getAIInsightsForToken(
  token: string,
  params?: { limit?: number },
): Promise<AIInsightDto[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<AIInsightDto[]>(
    `/api/v1/ai/insights/${encodeURIComponent(token)}${query ? `?${query}` : ""}`,
  );
}

export async function voteAIInsight(
  insightId: number,
  vote: 1 | -1,
  userIdentifier?: string,
): Promise<{ insight_id: number; vote: number; updated: boolean }> {
  const search = new URLSearchParams({ vote: String(vote) });
  if (userIdentifier) search.set("user_identifier", userIdentifier);
  return fetchJson(
    `/api/v1/ai/insights/${insightId}/vote?${search.toString()}`,
    { method: "POST" },
  );
}

export async function getAlphaFeed(
  limit = 50,
): Promise<AlphaEvent[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetchJson<AlphaEvent[]>(`/api/v1/alpha-feed?${search.toString()}`);
}

export async function getTrendingNarratives(): Promise<Opportunity[]> {
  return fetchJson<Opportunity[]>("/api/v1/narratives/trending");
}

export async function getNarrativeTokens(): Promise<NarrativeTokenGroup[]> {
  return fetchJson<NarrativeTokenGroup[]>("/api/v1/narratives/tokens");
}

export async function getAirdrops(): Promise<Opportunity[]> {
  return fetchJson<Opportunity[]>("/api/v1/airdrops");
}

export async function getAlphaTop(): Promise<AlphaRankedOpportunity[]> {
  return fetchJson<AlphaRankedOpportunity[]>("/api/v1/alpha/top");
}

export async function getAlphaHourly(): Promise<AlphaRankedOpportunity[]> {
  return fetchJson<AlphaRankedOpportunity[]>("/api/v1/alpha/hourly");
}

export async function getAlphaDaily(): Promise<AlphaRankedOpportunity[]> {
  return fetchJson<AlphaRankedOpportunity[]>("/api/v1/alpha/daily");
}

export async function getRadarTop(): Promise<RadarEventDto[]> {
  return fetchJson<RadarEventDto[]>("/api/v1/radar/top");
}

export async function getRadarEventsForToken(
  token: string,
): Promise<RadarEventDto[]> {
  return fetchJson<RadarEventDto[]>(
    `/api/v1/radar/events/${encodeURIComponent(token)}`,
  );
}

export async function getOpportunityAnalysis(opportunityId: number): Promise<{
  id: number;
  opportunity_id: number;
  analysis_summary: string;
  key_factors: string | null;
  risk_assessment: string | null;
  confidence_explanation: string | null;
  trade_strategy: string | null;
  created_at: string;
}> {
  const path = `/api/v1/analysis/${opportunityId}`;
  return fetchJson(path);
}

export async function getSimulationTrades(params?: {
  limit?: number;
  token_symbol?: string;
}): Promise<
  {
    id: number;
    opportunity_id: number;
    token_symbol: string;
    entry_price: number;
    exit_price: number;
    entry_timestamp: string;
    exit_timestamp: string;
    profit_percent: number;
    profit_usd: number;
    created_at: string;
  }[]
> {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  if (params?.token_symbol) {
    search.set("token_symbol", params.token_symbol);
  }
  const query = search.toString();
  const path = `/api/v1/simulation/trades${query ? `?${query}` : ""}`;
  return fetchJson(path);
}

export async function getSimulationPortfolios(): Promise<
  {
    id: number;
    portfolio_name: string;
    starting_balance: number;
    current_balance: number;
    created_at: string;
    updated_at: string;
  }[]
> {
  return fetchJson("/api/v1/simulation/portfolio");
}

export async function getSimulationPerformance(params?: {
  portfolio_id?: number;
  starting_balance?: number;
}): Promise<{
  starting_balance: number;
  total_return: number;
  win_rate: number;
  average_trade_roi: number;
  max_drawdown: number;
}> {
  const search = new URLSearchParams();
  if (params?.portfolio_id != null) {
    search.set("portfolio_id", String(params.portfolio_id));
  }
  if (params?.starting_balance != null) {
    search.set("starting_balance", String(params.starting_balance));
  }
  const query = search.toString();
  const path = `/api/v1/simulation/performance${query ? `?${query}` : ""}`;
  return fetchJson(path);
}

export async function getLatestBriefing(): Promise<{
  id: number;
  summary: string;
  top_opportunities: any | null;
  top_tokens: any | null;
  radar_events: any | null;
  market_sentiment: string | null;
  created_at: string;
}> {
  return fetchJson("/api/v1/briefings/latest");
}

export async function getResearchReport(opportunityId: number): Promise<{
  id: number;
  opportunity_id: number;
  report_content: string;
  project_overview: string;
  signal_analysis: string;
  risk_factors: string;
  potential_upside: string;
  market_narrative: string;
  created_at: string;
}> {
  const path = `/api/v1/reports/${opportunityId}`;
  return fetchJson(path);
}

export async function getCandidateProjects(
  limit = 50,
): Promise<CandidateProject[]> {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetchJson<CandidateProject[]>(
    `/api/v1/projects?${search.toString()}`,
  );
}

type PremiumAlertSubscription = {
  id: number;
  user_identifier: string;
  plan_type: string;
  alert_types: string[];
  minimum_score: number;
  created_at: string;
  updated_at: string;
};

export async function getPremiumAlerts(): Promise<PremiumAlertSubscription[]> {
  return fetchJson<PremiumAlertSubscription[]>("/api/v1/premium-alerts");
}

export async function createPremiumAlert(payload: {
  user_identifier: string;
  plan_type: string;
  alert_types: string[];
  minimum_score: number;
}): Promise<PremiumAlertSubscription> {
  return fetchJson<PremiumAlertSubscription>("/api/v1/premium-alerts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deletePremiumAlert(id: number): Promise<void> {
  await fetchJson(`/api/v1/premium-alerts/${id}`, { method: "DELETE" });
}

export async function getTopPools(limit = 20): Promise<
  {
    id: number;
    dex: string;
    pair: string;
    token_a: string;
    token_b: string;
    liquidity_usd: number;
    volume_24h: number;
    fee_percent: number;
    updated_at: string;
  }[]
> {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetchJson(`/api/v1/liquidity/top-pools?${search.toString()}`);
}

export async function getLiquidityChanges(limit = 50): Promise<
  {
    id: number;
    signal_type: string;
    token_symbol: string | null;
    chain: string | null;
    signal_strength: number;
    confidence_score: number;
    source: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string | null;
  }[]
> {
  const search = new URLSearchParams({ limit: String(limit) });
  return fetchJson(`/api/v1/liquidity/changes?${search.toString()}`);
}

export type SignalsFilter = {
  chain?: string;
  signal_type?: string;
  token?: string;
  limit?: number;
  offset?: number;
};

export async function getSignals(params?: SignalsFilter): Promise<SignalDto[]> {
  const search = new URLSearchParams();
  if (params?.chain) search.set("chain", params.chain);
  if (params?.signal_type) search.set("signal_type", params.signal_type);
  if (params?.token) search.set("token", params.token);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const query = search.toString();
  return fetchJson<SignalDto[]>(`/api/v1/signals${query ? `?${query}` : ""}`);
}

export async function getSignalsLatest(params?: {
  limit?: number;
  chain?: string;
  signal_type?: string;
}): Promise<SignalDto[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.chain) search.set("chain", params.chain);
  if (params?.signal_type) search.set("signal_type", params.signal_type);
  const query = search.toString();
  return fetchJson<SignalDto[]>(`/api/v1/signals/latest${query ? `?${query}` : ""}`);
}

export async function getSignalsForToken(
  token: string,
  params?: { chain?: string; signal_type?: string; limit?: number },
): Promise<SignalDto[]> {
  const search = new URLSearchParams();
  if (params?.chain) search.set("chain", params.chain);
  if (params?.signal_type) search.set("signal_type", params.signal_type);
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<SignalDto[]>(
    `/api/v1/signals/${encodeURIComponent(token)}${query ? `?${query}` : ""}`,
  );
}

export async function getSignalsTrending(params?: {
  hours?: number;
  limit?: number;
}): Promise<TrendingSignalTokenDto[]> {
  const search = new URLSearchParams();
  if (params?.hours != null) search.set("hours", String(params.hours));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return fetchJson<TrendingSignalTokenDto[]>(
    `/api/v1/signals/trending${query ? `?${query}` : ""}`,
  );
}

export type ChainDto = {
  name: string;
  symbol: string;
  tvl: number;
  tvl_24h_change: number;
  netflow_24h: number;
  active_users: number | null;
  momentum_score: number;
  whale_inflow_24h?: number | null;
  bridge_inflow_24h?: number | null;
};

/**
 * Chains use same-origin /api/v1/chains so the Next.js route can proxy to the
 * backend or fall back to DeFiLlama when the backend lacks the chains endpoint.
 */
export async function getChains(params?: {
  limit?: number;
  sort_by?: "netflow" | "tvl" | "momentum" | "tvl_change";
}): Promise<ChainDto[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.sort_by) search.set("sort_by", params.sort_by);
  const query = search.toString();
  const path = `/api/v1/chains${query ? `?${query}` : ""}`;
  // Always use same-origin so Next.js proxy/fallback handles the request
  const url =
    typeof window !== "undefined"
      ? path
      : (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "") + path;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API request failed with status ${res.status}`);
  return res.json() as Promise<ChainDto[]>;
}

export type ChainCoinDto = {
  name: string;
  symbol: string;
  slug: string;
  price: number;
  change_24h: number | null;
};

export type ChainProtocolDto = {
  name: string;
  tvl: number;
  category: string;
};

export type ChainExpansionDto = {
  protocols: ChainProtocolDto[];
  coins: ChainCoinDto[];
};

export async function getChainExpansion(
  chainName: string,
  limit?: number,
): Promise<ChainExpansionDto> {
  const search = new URLSearchParams();
  if (limit != null) search.set("limit", String(limit));
  const query = search.toString();
  const path = `/api/v1/chains/${encodeURIComponent(chainName)}/expansion${query ? `?${query}` : ""}`;
  const url =
    typeof window !== "undefined"
      ? path
      : (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "") + path;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return { protocols: [], coins: [] };
  return res.json() as Promise<ChainExpansionDto>;
}

/** @deprecated Use getChainExpansion for protocols + coins */
export async function getChainCoins(
  chainName: string,
  limit?: number,
): Promise<ChainCoinDto[]> {
  const data = await getChainExpansion(chainName, limit);
  return data.coins;
}

export type ExchangeDto = {
  id: string;
  name: string;
  slug: string;
  image: string;
  trust_score_rank: number;
  trust_score: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_usd: number;
  url: string;
  final_url: string;
  year_established: number | null;
  country: string | null;
  liquidity_score?: number;
  user_count_estimate?: number;
  supported_coins?: number;
};

export async function getExchanges(): Promise<ExchangeDto[]> {
  const path = "/api/v1/exchanges";
  const url =
    typeof window !== "undefined"
      ? path
      : (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "") + path;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Exchanges API failed: ${res.status}`);
  return res.json() as Promise<ExchangeDto[]>;
}

export async function getExchangeBySlug(slug: string): Promise<ExchangeDto | null> {
  const path = `/api/v1/exchanges/${encodeURIComponent(slug)}`;
  const url =
    typeof window !== "undefined"
      ? path
      : (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "") + path;
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Exchange API failed: ${res.status}`);
  return res.json() as Promise<ExchangeDto>;
}

export async function trackExchangeClick(exchangeId: string): Promise<void> {
  const path = `/api/v1/exchanges/${encodeURIComponent(exchangeId)}/click`;
  const url =
    typeof window !== "undefined"
      ? path
      : (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "") + path;
  await fetch(url, { method: "POST" }).catch(() => {});
}

export async function getSignalsLeaderboard(params?: {
  hours?: number;
  limit?: number;
  sort_by?: "signal_strength" | "signal_count" | "confidence_score";
}): Promise<TrendingSignalTokenDto[]> {
  const search = new URLSearchParams();
  if (params?.hours != null) search.set("hours", String(params.hours));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.sort_by) search.set("sort_by", params.sort_by);
  const query = search.toString();
  return fetchJson<TrendingSignalTokenDto[]>(
    `/api/v1/signals/leaderboard${query ? `?${query}` : ""}`,
  );
}
