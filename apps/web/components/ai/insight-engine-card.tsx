"use client";

import { useState } from "react";
import { Database, ThumbsDown, ThumbsUp } from "lucide-react";
import { clsx } from "clsx";
import type { AIInsightDto } from "@/lib/api";
import { voteAIInsight } from "@/lib/api";
import {
  presentInsightTypeLabel,
  reasoningPreamble,
  rollupSourceSummary,
} from "@/lib/ai-insight-present";

type Props = {
  insight: AIInsightDto;
  compact?: boolean;
};

function confidenceBadge(score: number): { label: string; cls: string } {
  if (score >= 0.8) return { label: "High", cls: "border-emerald-500/50 text-emerald-600 dark:text-emerald-300" };
  if (score >= 0.5) return { label: "Medium", cls: "border-amber-500/50 text-amber-700 dark:text-amber-200" };
  return { label: "Low", cls: "border-[var(--b70-border)] text-[var(--b70-text-muted)]" };
}

export function InsightEngineCard({ insight, compact = false }: Props) {
  const [voteState, setVoteState] = useState<"idle" | "sending" | "done" | "err">("idle");
  const badge = confidenceBadge(insight.confidence_score ?? 0);
  const typeLabel = presentInsightTypeLabel(insight.insight_type);
  const preamble = reasoningPreamble(insight.insight_type);
  const rollup = rollupSourceSummary(insight.sources);
  const sources = insight.sources ?? [];

  async function sendVote(v: 1 | -1) {
    const userId = process.env.NEXT_PUBLIC_USER_IDENTIFIER ?? "anonymous";
    setVoteState("sending");
    try {
      await voteAIInsight(insight.id, v, userId);
      setVoteState("done");
    } catch {
      setVoteState("err");
    }
  }

  return (
    <article
      className={clsx(
        "rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 text-sm shadow-sm",
        "transition-colors hover:border-[var(--b70-crypto-blue)]/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--b70-crypto-blue)]/35 bg-[var(--b70-crypto-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-crypto-blue)]">
              {typeLabel}
            </span>
            <span
              className={clsx(
                "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                badge.cls,
              )}
            >
              {badge.label}
            </span>
          </div>
          <h3 className="font-[family-name:var(--font-jetbrains)] font-semibold text-[var(--b70-text)]">
            {insight.title}
          </h3>
        </div>
      </div>

      {insight.summary && !compact ? (
        <p className="mt-2 leading-relaxed text-[var(--b70-text-muted)]">{insight.summary}</p>
      ) : insight.summary && compact ? (
        <p className="mt-2 line-clamp-2 text-xs text-[var(--b70-text-muted)]">{insight.summary}</p>
      ) : null}

      {!compact ? (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
            Reasoning (explanatory)
          </p>
          <p className="text-[var(--b70-text-muted)]">{preamble}</p>
          <p className="text-[11px] text-[var(--b70-text-muted)]">{rollup}</p>
        </div>
      ) : null}

      {sources.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
            <Database className="h-3.5 w-3.5" aria-hidden />
            Data sources
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {sources.slice(0, 8).map((s, idx) => (
              <li
                key={`${s.source_type}-${s.source_id}-${idx}`}
                className="max-w-full truncate rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-0.5 font-mono text-[10px] text-[var(--b70-text)]"
                title={`${s.source_type}: ${s.source_id}`}
              >
                {s.source_type}: {s.source_id}
              </li>
            ))}
          </ul>
          {sources.length > 8 ? (
            <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
              +{sources.length - 8} more
            </p>
          ) : null}
        </div>
      ) : !compact ? (
        <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">{rollup}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--b70-border)] pt-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--b70-text-muted)]">
          <span>Model confidence {(insight.confidence_score * 100).toFixed(0)}%</span>
          {insight.related_tokens?.length ? (
            <span className="font-mono text-[var(--b70-text)]">
              {insight.related_tokens.join(", ")}
            </span>
          ) : null}
          {insight.created_at ? (
            <span>{new Date(insight.created_at).toLocaleString()}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={voteState === "sending"}
            onClick={() => void sendVote(1)}
            className="rounded-lg border border-[var(--b70-border)] p-1.5 text-[var(--b70-text-muted)] hover:border-emerald-500/50 hover:text-emerald-600 disabled:opacity-50"
            aria-label="Mark helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={voteState === "sending"}
            onClick={() => void sendVote(-1)}
            className="rounded-lg border border-[var(--b70-border)] p-1.5 text-[var(--b70-text-muted)] hover:border-rose-500/50 hover:text-rose-600 disabled:opacity-50"
            aria-label="Mark not helpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          {voteState === "done" ? (
            <span className="text-[10px] text-[var(--b70-text-muted)]">Thanks</span>
          ) : null}
          {voteState === "err" ? (
            <span className="text-[10px] text-rose-600 dark:text-rose-400">Vote failed</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
