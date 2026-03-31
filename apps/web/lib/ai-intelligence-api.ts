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
};

export type CapitalRotationRow = {
  narrative_id: string;
  label?: string;
  phase: string;
};

export type AIIntelligenceOpportunitiesResponse = {
  opportunities: AIIntelligenceOpportunity[];
  market_regime: string;
  capital_rotation: CapitalRotationRow[];
  synthetic_fallback: boolean;
  model_insights: string[];
};

export type GetOpportunitiesParams = {
  limit?: number;
  timeframe?: AIIntelligenceTimeframe;
  minMcap?: number;
  risk?: AIIntelligenceRisk | "";
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
