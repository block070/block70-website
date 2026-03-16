"use client";

import type { SignalDto } from "@/lib/types";
import Link from "next/link";

type SignalHeatmapProps = {
  signals: SignalDto[];
  /** Max items to show (by count). */
  maxTokens?: number;
  /** "token" = intensity per token; "signal_type" = intensity per signal type (e.g. on token page). */
  groupBy?: "token" | "signal_type";
};

function intensityToColor(strength: number): string {
  if (strength >= 0.8) return "bg-emerald-500";
  if (strength >= 0.6) return "bg-emerald-600";
  if (strength >= 0.4) return "bg-amber-500";
  if (strength >= 0.2) return "bg-amber-600";
  return "bg-slate-600";
}

export function SignalHeatmap({
  signals,
  maxTokens = 24,
  groupBy = "token",
}: SignalHeatmapProps) {
  const byKey = new Map<string, { count: number; avgStrength: number }>();

  for (const s of signals) {
    const key =
      groupBy === "signal_type"
        ? (s.signal_type || "unknown").trim() || "unknown"
        : (s.token_symbol || s.token_address || "unknown").trim() || "unknown";
    const cur = byKey.get(key) ?? { count: 0, avgStrength: 0 };
    const strength = s.signal_strength ?? 0;
    byKey.set(key, {
      count: cur.count + 1,
      avgStrength: (cur.avgStrength * cur.count + strength) / (cur.count + 1),
    });
  }

  const entries = [...byKey.entries()]
    .filter(([k]) => k !== "unknown")
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxTokens);

  if (entries.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No token signal data to display.
      </section>
    );
  }

  const maxCount = Math.max(...entries.map(([, v]) => v.count), 1);
  const isByType = groupBy === "signal_type";

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
      <h3 className="text-sm font-semibold text-slate-50">Signal heatmap</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        {isByType
          ? "Color intensity by signal type for this token."
          : "Color intensity by signal activity per token."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {entries.map(([key, { count, avgStrength }]) => {
          const intensity = count / maxCount;
          const color = intensityToColor(avgStrength);
          const label = isByType ? key.replace(/_/g, " ") : key;
          const href = isByType ? undefined : `/signals/${encodeURIComponent(key)}`;
          const content = (
            <span
              className={`rounded px-2 py-1.5 text-[11px] font-medium text-slate-100 transition-opacity hover:opacity-90 ${color}`}
              style={{ opacity: 0.6 + intensity * 0.4 }}
              title={`${label}: ${count} signals, avg strength ${(avgStrength * 100).toFixed(0)}%`}
            >
              {label}
            </span>
          );
          if (href) {
            return (
              <Link key={key} href={href}>
                {content}
              </Link>
            );
          }
          return <span key={key}>{content}</span>;
        })}
      </div>
    </section>
  );
}
