"use client";

import type { AIInsightDto } from "@/lib/api";

type InsightCardProps = {
  insight: AIInsightDto;
  showTokens?: boolean;
  className?: string;
};

function confidenceLabel(score: number): string {
  if (score >= 0.8) return "High";
  if (score >= 0.5) return "Medium";
  return "Low";
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return "text-emerald-400 border-emerald-500/40";
  if (score >= 0.5) return "text-amber-400 border-amber-500/40";
  return "text-slate-400 border-slate-500/40";
}

export function InsightCard({
  insight,
  showTokens = true,
  className = "",
}: InsightCardProps) {
  const confLabel = confidenceLabel(insight.confidence_score);
  const confColor = confidenceColor(insight.confidence_score);

  return (
    <article
      className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm ${className}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-50">{insight.title}</h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${confColor}`}
        >
          {confLabel}
        </span>
      </div>
      {insight.summary && (
        <p className="mb-3 text-slate-400">{insight.summary}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-slate-500">
          Confidence: {(insight.confidence_score * 100).toFixed(0)}%
        </span>
        <span className="text-[10px] text-slate-500">
          Type: {insight.insight_type.replace(/_/g, " ")}
        </span>
        {showTokens && insight.related_tokens?.length > 0 && (
          <span className="text-[10px] text-slate-500">
            Tokens:{" "}
            <span className="font-mono text-slate-300">
              {insight.related_tokens.join(", ")}
            </span>
          </span>
        )}
      </div>
      {insight.created_at && (
        <p className="mt-2 text-[10px] text-slate-600">
          {new Date(insight.created_at).toLocaleString()}
        </p>
      )}
    </article>
  );
}
