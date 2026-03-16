"use client";

import { useState } from "react";
import { voteSentiment, type SentimentSummaryDto } from "@/lib/sentiment-api";
import { getToken } from "@/lib/auth";

type SentimentType = "bullish" | "neutral" | "bearish";

type Props = {
  tokenSymbol: string;
  initialSummary?: SentimentSummaryDto | null;
  onVoted?: (summary: SentimentSummaryDto) => void;
  className?: string;
};

export function SentimentVote({
  tokenSymbol,
  initialSummary,
  onVoted,
  className = "",
}: Props) {
  const [summary, setSummary] = useState<SentimentSummaryDto | null>(
    initialSummary ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAuth = typeof window !== "undefined" && !!getToken();

  async function handleVote(sentiment: SentimentType) {
    if (!isAuth) {
      setError("Log in to vote");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { summary: next } = await voteSentiment(tokenSymbol, sentiment);
      setSummary(next);
      onVoted?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote failed");
    } finally {
      setLoading(false);
    }
  }

  const s = summary ?? initialSummary;
  const total = s
    ? s.bullish_count + s.neutral_count + s.bearish_count
    : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-medium text-[var(--b70-text-muted)]">
        Community sentiment
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleVote("bullish")}
          disabled={loading}
          className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
        >
          Bullish
        </button>
        <button
          type="button"
          onClick={() => handleVote("neutral")}
          disabled={loading}
          className="rounded-lg border border-slate-600/50 bg-slate-800/40 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700/40 disabled:opacity-50"
        >
          Neutral
        </button>
        <button
          type="button"
          onClick={() => handleVote("bearish")}
          disabled={loading}
          className="rounded-lg border border-rose-600/50 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/40 disabled:opacity-50"
        >
          Bearish
        </button>
      </div>
      {total > 0 && s ? (
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          {s.bullish_count} bullish · {s.neutral_count} neutral · {s.bearish_count} bearish
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : null}
    </div>
  );
}
