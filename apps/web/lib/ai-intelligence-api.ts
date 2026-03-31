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
  volatility_index?: number | null;
  risk_tier?: string | null;
};

export type GetOpportunitiesParams = {
  limit?: number;
  timeframe?: AIIntelligenceTimeframe;
  minMcap?: number;
  risk?: AIIntelligenceRisk | "";
};

export async function getAIIntelligenceOpportunities(
  params: GetOpportunitiesParams = {},
): Promise<AIIntelligenceOpportunity[]> {
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
  return res.json();
}

export type AIIntelligenceAnalyzeResult = {
  query: string;
  top_opportunities: AIIntelligenceOpportunity[];
  key_trends: string[];
  risks: string[];
  summary: string;
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
