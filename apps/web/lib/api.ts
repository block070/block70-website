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
// Client (browser): use NEXT_PUBLIC_API_BASE_URL. No hardcoded localhost.
// Fallback to "" so the app can build when env is not set at build time (e.g. Docker build).
// At runtime, set NEXT_PUBLIC_API_BASE_URL and API_SERVER_URL so requests hit your API.
export const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
    : process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
  title: string;
  source: string;
  url: string;
  summary?: string | null;
  content?: string | null;
  published_at?: string | null;
};

export async function getNewsArticles(params?: {
  limit?: number;
}): Promise<NewsArticleSummary[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  const query = search.toString();
  return fetchJson<NewsArticleSummary[]>(
    `/api/v1/articles${query ? `?${query}` : ""}`,
  );
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
