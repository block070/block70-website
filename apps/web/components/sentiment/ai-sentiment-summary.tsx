"use client";

import { useEffect, useState } from "react";

type Props = {
  tokenSymbol: string;
  className?: string;
};

type SummaryDto = {
  token_symbol: string;
  summary_text: string;
  bullish_pct: number;
  neutral_pct: number;
  bearish_pct: number;
  signal_count: number;
  avg_confidence: number;
};

export function AISentimentSummary({ tokenSymbol, className = "" }: Props) {
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/sentiment/${encodeURIComponent(tokenSymbol)}/ai-summary`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [tokenSymbol]);

  if (loading) return <p className="text-xs text-[var(--b70-text-muted)]">Loading AI summary…</p>;
  if (!summary) return null;

  return (
    <div className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 text-xs ${className}`}>
      <h3 className="text-sm font-semibold text-[var(--b70-text)]">AI sentiment summary</h3>
      <p className="mt-2 text-[var(--b70-text-muted)]">{summary.summary_text}</p>
      <p className="mt-2 text-[11px] text-[var(--b70-text-muted)]">
        Bullish {summary.bullish_pct.toFixed(0)}% · Neutral {summary.neutral_pct.toFixed(0)}% · Bearish {summary.bearish_pct.toFixed(0)}%
        {summary.signal_count > 0 ? ` · ${summary.signal_count} signals` : ""}
      </p>
    </div>
  );
}
