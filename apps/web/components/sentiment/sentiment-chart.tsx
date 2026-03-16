"use client";

import type { SentimentSummaryDto } from "@/lib/sentiment-api";

type Props = {
  summary: SentimentSummaryDto | null;
  className?: string;
};

export function SentimentChart({ summary, className = "" }: Props) {
  if (!summary) {
    return (
      <div className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 ${className}`}>
        <p className="text-xs text-[var(--b70-text-muted)]">No sentiment data yet.</p>
      </div>
    );
  }

  const total = summary.bullish_count + summary.neutral_count + summary.bearish_count;
  if (total === 0) {
    return (
      <div className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 ${className}`}>
        <p className="text-xs text-[var(--b70-text-muted)]">No votes yet.</p>
      </div>
    );
  }

  const bullPct = (summary.bullish_count / total) * 100;
  const neutralPct = (summary.neutral_count / total) * 100;
  const bearPct = (summary.bearish_count / total) * 100;

  return (
    <div className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-[var(--b70-text)]">Sentiment distribution</h3>
      <div className="mt-3 flex h-8 w-full overflow-hidden rounded-lg bg-[var(--b70-bg)]">
        <div
          className="bg-emerald-600 transition-all"
          style={{ width: `${bullPct}%` }}
          title={`Bullish ${bullPct.toFixed(0)}%`}
        />
        <div
          className="bg-slate-600 transition-all"
          style={{ width: `${neutralPct}%` }}
          title={`Neutral ${neutralPct.toFixed(0)}%`}
        />
        <div
          className="bg-rose-600 transition-all"
          style={{ width: `${bearPct}%` }}
          title={`Bearish ${bearPct.toFixed(0)}%`}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--b70-text-muted)]">
        <span>Bullish {summary.bullish_count}</span>
        <span>Neutral {summary.neutral_count}</span>
        <span>Bearish {summary.bearish_count}</span>
      </div>
    </div>
  );
}
