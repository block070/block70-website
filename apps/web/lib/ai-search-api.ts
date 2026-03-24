import { getToken } from "./auth";

// Use same-origin proxy to avoid CORS and mixed content (HTTPS page → HTTP API).
const AI_SEARCH_BASE = typeof window !== "undefined" ? "" : process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export type AISearchMode = "general" | "signals" | "investing" | "depin" | "beginner";

export type AISearchChatTurn = {
  role: "user" | "assistant";
  content: string;
};

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

export type PostAISearchParams = {
  queryText: string;
  mode?: AISearchMode;
  /** Full transcript; when set, backend composes context from the last turns. */
  conversation?: AISearchChatTurn[];
};

export async function postAISearch(
  queryTextOrParams: string | PostAISearchParams
): Promise<AISearchResult> {
  const params: PostAISearchParams =
    typeof queryTextOrParams === "string"
      ? { queryText: queryTextOrParams }
      : queryTextOrParams;

  const body: Record<string, unknown> = {
    query_text: params.queryText ?? "",
  };
  if (params.mode) body.mode = params.mode;
  if (params.conversation && params.conversation.length > 0) {
    body.conversation = params.conversation;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = typeof window !== "undefined" ? "/api/ai-search" : `${AI_SEARCH_BASE}/api/v1/ai-search`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: string })?.detail;
    if (res.status === 401 || detail === "Not authenticated") {
      throw new Error("Please log in and try again.");
    }
    throw new Error(detail || "AI search failed");
  }
  return res.json();
}

export async function getAISearchPopular(limit = 20): Promise<{ query_normalized: string; hit_count: number }[]> {
  const url = typeof window !== "undefined" ? `/api/ai-search/popular?limit=${limit}` : `${AI_SEARCH_BASE}/api/v1/ai-search/popular?limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function getAISearchHistory(): Promise<
  { id: number; query_text: string; response_text: string; confidence_score: number | null; created_at: string }[]
> {
  const token = getToken();
  if (!token) return [];
  const url = typeof window !== "undefined" ? "/api/ai-search/history" : `${AI_SEARCH_BASE}/api/v1/ai-search/history`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
