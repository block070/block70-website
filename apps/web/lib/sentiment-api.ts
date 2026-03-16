import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type SentimentSummaryDto = {
  token_symbol: string;
  bullish_count: number;
  neutral_count: number;
  bearish_count: number;
  updated_at: string | null;
};

export async function getSentiment(token: string): Promise<SentimentSummaryDto> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/sentiment/${encodeURIComponent(token.trim().toUpperCase())}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Sentiment API error");
  return res.json();
}

export async function voteSentiment(
  tokenSymbol: string,
  sentiment: "bullish" | "neutral" | "bearish",
): Promise<{ summary: SentimentSummaryDto }> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}/api/v1/sentiment/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token_symbol: tokenSymbol.trim().toUpperCase(), sentiment }),
  });
  if (!res.ok) throw new Error("Vote failed");
  const data = await res.json();
  const summary: SentimentSummaryDto = {
    token_symbol: data.token_symbol ?? tokenSymbol.trim().toUpperCase(),
    bullish_count: data.summary?.bullish_count ?? 0,
    neutral_count: data.summary?.neutral_count ?? 0,
    bearish_count: data.summary?.bearish_count ?? 0,
    updated_at: data.summary?.updated_at ?? null,
  };
  return { summary };
}
