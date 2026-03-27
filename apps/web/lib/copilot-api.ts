import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type CopilotInsightDto = {
  id: number;
  user_id: number;
  insight_type: string;
  title: string;
  summary: string | null;
  confidence_score: number;
  related_tokens: string[];
  suggested_actions: Array<{ action: string; token?: string }>;
  created_at: string;
};

export type CopilotPortfolioDto = {
  risk_concentrations: Array<{
    token_symbol: string;
    allocation_pct: number;
    value_usd: number;
    risk_level: string;
  }>;
  opportunities: Array<{
    token_symbol: string;
    reason: string;
    confidence: number;
  }>;
  whale_overlaps: Array<{
    token_symbol: string;
    overlap_type: string;
    description: string;
  }>;
  portfolio_tokens: string[];
  total_value_usd: number;
};

export type CopilotOpportunityDto = {
  token_symbol: string;
  source: string;
  title: string;
  summary: string;
  confidence: number;
  risk_level?: string;
  entry_note?: string;
  exit_note?: string;
};

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Copilot API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getCopilotInsights(params?: {
  insight_type?: string;
  limit?: number;
  offset?: number;
}): Promise<CopilotInsightDto[]> {
  const search = new URLSearchParams();
  if (params?.insight_type) search.set("insight_type", params.insight_type);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const q = search.toString();
  return fetchWithAuth<CopilotInsightDto[]>(`/api/v1/copilot/insights${q ? `?${q}` : ""}`);
}

export async function getCopilotPortfolio(): Promise<CopilotPortfolioDto> {
  return fetchWithAuth<CopilotPortfolioDto>("/api/v1/copilot/portfolio");
}

export async function getCopilotOpportunities(params?: {
  limit?: number;
  min_confidence?: number;
}): Promise<CopilotOpportunityDto[]> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.min_confidence != null) search.set("min_confidence", String(params.min_confidence));
  const q = search.toString();
  return fetchWithAuth<CopilotOpportunityDto[]>(`/api/v1/copilot/opportunities${q ? `?${q}` : ""}`);
}

export async function generateCopilotInsights(params?: {
  max_insights?: number;
  min_confidence?: number;
}): Promise<CopilotInsightDto[]> {
  const search = new URLSearchParams();
  if (params?.max_insights != null) search.set("max_insights", String(params.max_insights));
  if (params?.min_confidence != null) search.set("min_confidence", String(params.min_confidence));
  const q = search.toString();
  return fetchWithAuth<CopilotInsightDto[]>(`/api/v1/copilot/insights/generate?${q || "max_insights=25&min_confidence=0.35"}`, {
    method: "POST",
  });
}
