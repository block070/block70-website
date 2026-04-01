import { getToken } from "./auth";

const BASE =
  typeof window !== "undefined" ? "" : process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export type AIIntelligenceTimeframe = "24h" | "7d";
export type AIIntelligenceRisk = "low" | "medium" | "high";

export type OpportunitySignals = {
  momentum: number;
  volume: number;
  social: number;
  dev: number;
  whales: number;
  sentiment: number;
  risk: number;
};

export type AIIntelligenceOpportunity = {
  asset_symbol: string;
  name?: string | null;
  coingecko_id?: string | null;
  score: number;
  signals: OpportunitySignals;
  market_cap?: number | null;
  volume_24h?: number | null;
  price_change_24h?: number | null;
  price_change_7d?: number | null;
  price_change_1h?: number | null;
  volatility_index?: number | null;
  risk_tier?: string | null;
  confidence_score?: number | null;
  probability_of_move?: number | null;
  confluence_score?: number | null;
  cycle_stage?: string | null;
  entry_signal?: string | null;
  time_horizon?: string | null;
  signal_freshness?: string | null;
  rank_delta?: number | null;
  rank_reasons?: string[] | null;
  low_conviction_move?: boolean | null;
  narrative_flow_boost?: number | null;
  narrative_tags?: string[] | null;
  intent_primary_match?: boolean | null;
  current_price?: number | null;
  confluence_flags?: string[] | null;
};

export type CapitalRotationRow = {
  narrative_id: string;
  label?: string;
  phase: string;
};

export type QueryIntentDebug = {
  intent?: string;
  output_mode?: string;
  filter_narratives?: string[] | null;
  focus_symbols?: string[] | null;
  sort_mode?: string;
  prob_bias?: number;
  weight_mult?: Record<string, number>;
  strict_ticker_match?: boolean;
};

export type CoinIntelPrediction = {
  direction: string;
  horizon: string;
  horizon_display: string;
  strength: string;
};

export type CoinIntelProfile = {
  category?: string | null;
  category_slug?: string | null;
  description_preview?: string | null;
  logo_url?: string | null;
};

export type CoinIntelPayload = {
  hero_call: {
    headline: string;
    direction_label: string;
    timeframe_label: string;
    confidence_tier: string;
  };
  positioning_insight: { lines: string[] };
  risk_context: { lines: string[] };
  entry_context: { label: string; explanation: string } | null;
  prediction: CoinIntelPrediction;
  overview: Record<string, unknown>;
  signals: { primary_driver: string; supporting: string[] };
  relative_strength: { vs_btc_pct: number; vs_eth_pct: number; score: number };
  narrative_flow: { narrative_id: string; phase: string | null }[];
  news_insight: { lines: string[]; headline_count: number; sentiment_score: number | null };
  headlines: { title: string; url: string; source: string; published_at: string | null }[];
  related: {
    narrative_leaders: Record<string, unknown>[];
    earlier_stage: Record<string, unknown>[];
  };
  coin_page: { slug: string | null; href: string | null };
  coin_profile?: CoinIntelProfile | null;
  query_intent?: QueryIntentDebug;
};

export type AIIntelligenceOpportunitiesResponse = {
  opportunities: AIIntelligenceOpportunity[];
  market_regime: string;
  capital_rotation: CapitalRotationRow[];
  synthetic_fallback: boolean;
  model_insights: string[];
  query_intent?: QueryIntentDebug;
  predictions?: string[];
  recent_shifts?: string[];
  portfolio_positioning?: Record<string, string[]>;
  coin_intel?: CoinIntelPayload | null;
  coin_fallback?: boolean;
};

export type GetOpportunitiesParams = {
  limit?: number;
  timeframe?: AIIntelligenceTimeframe;
  minMcap?: number;
  risk?: AIIntelligenceRisk | "";
  query?: string;
};

function normalizeOpportunitiesPayload(data: unknown): AIIntelligenceOpportunitiesResponse {
  if (Array.isArray(data)) {
    return {
      opportunities: data as AIIntelligenceOpportunity[],
      market_regime: "TRANSITION",
      capital_rotation: [],
      synthetic_fallback: false,
      model_insights: [],
    };
  }
  const o = data as Record<string, unknown>;
  return {
    opportunities: (Array.isArray(o.opportunities) ? o.opportunities : []) as AIIntelligenceOpportunity[],
    market_regime: typeof o.market_regime === "string" ? o.market_regime : "TRANSITION",
    capital_rotation: Array.isArray(o.capital_rotation) ? (o.capital_rotation as CapitalRotationRow[]) : [],
    synthetic_fallback: Boolean(o.synthetic_fallback),
    model_insights: Array.isArray(o.model_insights) ? (o.model_insights as string[]) : [],
    query_intent: (o.query_intent && typeof o.query_intent === "object"
      ? (o.query_intent as QueryIntentDebug)
      : undefined),
    predictions: Array.isArray(o.predictions) ? (o.predictions as string[]) : undefined,
    recent_shifts: Array.isArray(o.recent_shifts) ? (o.recent_shifts as string[]) : undefined,
    portfolio_positioning:
      o.portfolio_positioning && typeof o.portfolio_positioning === "object"
        ? (o.portfolio_positioning as Record<string, string[]>)
        : undefined,
    coin_intel: (o.coin_intel && typeof o.coin_intel === "object" ? (o.coin_intel as CoinIntelPayload) : null) ?? null,
    coin_fallback: Boolean(o.coin_fallback),
  };
}

export async function getAIIntelligenceOpportunities(
  params: GetOpportunitiesParams = {},
): Promise<AIIntelligenceOpportunitiesResponse> {
  const sp = new URLSearchParams();
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.timeframe) sp.set("timeframe", params.timeframe);
  if (params.minMcap != null && params.minMcap > 0) sp.set("min_mcap", String(params.minMcap));
  if (params.risk) sp.set("risk", params.risk);
  if (params.query != null && params.query.trim()) sp.set("query", params.query.trim());

  const q = sp.toString();
  const path = `/api/ai-intelligence/opportunities${q ? `?${q}` : ""}`;
  const url = typeof window !== "undefined" ? path : `${BASE}/api/v1/ai-intelligence/opportunities${q ? `?${q}` : ""}`;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: string })?.detail;
    throw new Error(typeof detail === "string" ? detail : "Failed to load opportunities");
  }
  const raw: unknown = await res.json();
  return normalizeOpportunitiesPayload(raw);
}

export type AIIntelligenceAnalyzeResult = {
  query: string;
  top_opportunities: AIIntelligenceOpportunity[];
  key_trends: string[];
  risks: string[];
  summary: string;
  market_regime?: string;
  capital_rotation?: CapitalRotationRow[];
  portfolio_positioning?: Record<string, string[]>;
  predictions?: string[];
  recent_shifts?: string[];
  formatted_report?: string;
  model_insights?: string[];
  query_intent?: QueryIntentDebug;
  output_mode?: string;
};

export async function postAIIntelligenceAnalyze(query: string): Promise<AIIntelligenceAnalyzeResult> {
  const path = "/api/ai-intelligence/analyze";
  const url = typeof window !== "undefined" ? path : `${BASE}/api/v1/ai-intelligence/analyze`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: string })?.detail;
    throw new Error(typeof detail === "string" ? detail : "Analyze failed");
  }
  return res.json();
}
