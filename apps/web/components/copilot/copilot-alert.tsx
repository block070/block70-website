"use client";

import Link from "next/link";
import type { CopilotInsightDto } from "@/lib/copilot-api";

type Props = {
  insight: CopilotInsightDto;
  className?: string;
};

function confidenceLabel(score: number): string {
  if (score >= 0.8) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return "text-emerald-400";
  if (score >= 0.5) return "text-amber-400";
  return "text-slate-400";
}

export function CopilotAlert({ insight, className = "" }: Props) {
  const tokens = insight.related_tokens ?? [];
  const actions = insight.suggested_actions ?? [];

  return (
    <article
      className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-b70-card ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--b70-text)]">
          {insight.title}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor(
            insight.confidence_score,
          )} bg-[var(--b70-border)]/50`}
          title={`Confidence: ${(insight.confidence_score * 100).toFixed(0)}%`}
        >
          {confidenceLabel(insight.confidence_score)} ({(insight.confidence_score * 100).toFixed(0)}%)
        </span>
      </div>
      {insight.summary ? (
        <p className="mt-2 text-xs text-[var(--b70-text-muted)] line-clamp-2">
          {insight.summary}
        </p>
      ) : null}
      {tokens.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tokens.map((t) => (
            <Link
              key={t}
              href={`/radar/${encodeURIComponent(t)}`}
              className="rounded-md bg-crypto-blue/20 px-2 py-0.5 text-xs font-medium text-crypto-blue hover:bg-crypto-blue/30"
            >
              {t}
            </Link>
          ))}
        </div>
      ) : null}
      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <span key={i}>
              {a.action === "watch_token" && a.token ? (
                <Link
                  href={`/signals/${encodeURIComponent(a.token)}`}
                  className="text-xs font-medium text-crypto-blue hover:underline"
                >
                  Watch {a.token}
                </Link>
              ) : a.action === "view_opportunity" && a.token ? (
                <Link
                  href={`/radar/${encodeURIComponent(a.token)}`}
                  className="text-xs font-medium text-crypto-blue hover:underline"
                >
                  View opportunity
                </Link>
              ) : a.action === "set_alert" && a.token ? (
                <Link
                  href="/alerts"
                  className="text-xs font-medium text-crypto-blue hover:underline"
                >
                  Set alert
                </Link>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
