import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type AISearchResult = {
  answer: string;
  confidence_score: number;
  related_tokens: string[];
  related_signals: Array<{
    id: number;
    token_symbol?: string;
    signal_type?: string;
    title?: string;
    confidence_score?: number;
    created_at?: string;
  }>;
  related_opportunities: Array<{
    id: number;
    title?: string;
    slug?: string;
    asset_symbol?: string;
    total_score?: number;
    estimated_roi_percent?: number;
  }>;
  related_insights: Array<{
    id: number;
    title?: string;
    summary?: string;
  }>;
  related_radar: Array<{
    token_symbol?: string;
    event_type?: string;
    severity_score?: number;
    description?: string;
  }>;
  query_id: number | null;
  cached?: boolean;
};

export async function postAISearch(queryText: string): Promise<AISearchResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/api/v1/ai-search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query_text: queryText }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("AI search failed");
  return res.json();
}

export async function getAISearchPopular(limit = 20): Promise<{ query_normalized: string; hit_count: number }[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/ai-search/popular?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function getAISearchHistory(): Promise<
  { id: number; query_text: string; response_text: string; confidence_score: number | null; created_at: string }[]
> {
  const token = getToken();
  if (!token) return [];
  const res = await fetch(`${API_BASE_URL}/api/v1/ai-search/history`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
