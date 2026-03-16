"use client";

import { useEffect, useState } from "react";

import type { Opportunity } from "@/lib/types";
import {
  getInsightsTop,
  getInsightsTrending,
  getInsightsHighestRoi,
} from "@/lib/api";

type Trending = {
  category: string;
  key: string;
  magnitude: number;
  details: Record<string, unknown>;
  timestamp: string;
};

type TopInsights = {
  generated_at: string;
  arbitrage: Opportunity[];
  mining: Opportunity[];
  wallet: Opportunity[];
};

type ActivityEvent = {
  id: string;
  type: "arbitrage" | "wallet" | "mining";
  label: string;
  detail: string;
  timestamp: string;
};

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [topResp, trendingResp, highestRoiResp] = await Promise.all([
          getInsightsTop(),
          getInsightsTrending(),
          getInsightsHighestRoi(),
        ]);
        if (cancelled) return;

        const top = topResp as TopInsights;
        const trends = (trendingResp.trends ?? []) as Trending[];
        const highest = highestRoiResp as Opportunity[];

        const newEvents: ActivityEvent[] = [];

        // New arbitrage detected (top arbitrage slice)
        (top.arbitrage ?? []).slice(0, 3).forEach((op) => {
          newEvents.push({
            id: `arb-${op.id}`,
            type: "arbitrage",
            label: "New arbitrage detected",
            detail: `${op.title} · ${(op.total_score * 100).toFixed(0)} score`,
            timestamp: op.detected_at ?? top.generated_at,
          });
        });

        // Whale buy / accumulation trends
        trends
          .filter((t) => t.category === "whale_accumulation")
          .slice(0, 5)
          .forEach((t) => {
            newEvents.push({
              id: `whale-${t.key}-${t.timestamp}`,
              type: "wallet",
              label: "Whale buy detected",
              detail: `${t.key} · trend strength ${(t.magnitude * 100).toFixed(0)}%`,
              timestamp: t.timestamp,
            });
          });

        // Miner ROI improvements – approximate via highest ROI list for now
        (highest ?? [])
          .filter((op) => op.type === "mining")
          .slice(0, 3)
          .forEach((op) => {
            newEvents.push({
              id: `miner-${op.id}`,
              type: "mining",
              label: "Miner ROI improvement",
              detail: `${op.asset_symbol ?? "Miner"} · ${
                op.estimated_roi_percent != null
                  ? `${op.estimated_roi_percent.toFixed(1)}% ROI`
                  : "ROI n/a"
              }`,
              timestamp: op.detected_at ?? top.generated_at,
            });
          });

        // Sort newest first
        newEvents.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );

        setEvents(newEvents.slice(0, 15));
      } catch {
        if (!cancelled) {
          setError("Unable to load recent activity from the backend.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        Loading activity…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
        {error}
      </section>
    );
  }

  if (!events.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        No notable activity yet. As Block70 detects fresh arbitrage, whale moves, and
        miner shifts, they&apos;ll stream in here.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Real-time Activity
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        High-signal events across arbitrage, whales, and miners. Use this as a quick
        tape of what the engine is seeing.
      </p>

      <ul className="mt-3 space-y-2">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
          >
            <div className="space-y-0.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  ev.type === "arbitrage"
                    ? "border border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                    : ev.type === "wallet"
                      ? "border border-sky-500/60 bg-sky-500/10 text-sky-300"
                      : "border border-amber-500/60 bg-amber-500/10 text-amber-300"
                }`}
              >
                {ev.label}
              </span>
              <p className="text-[11px] text-slate-200">{ev.detail}</p>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              {new Date(ev.timestamp).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

