"use client";

import { useEffect, useState } from "react";

import type { Opportunity } from "@/lib/types";
import {
  getInsightsTrending,
  getInsightsHighestRoi,
  getRadarTop,
  getAlphaFeed,
} from "@/lib/api";

type Trending = {
  category: string;
  key: string;
  magnitude: number;
  details: Record<string, unknown>;
  timestamp: string;
};

export function OpportunityInsightFeed() {
  const [emerging, setEmerging] = useState<Opportunity[]>([]);
  const [trending, setTrending] = useState<Trending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [trendingResp, highestRoiResp] = await Promise.all([
          getInsightsTrending(),
          getInsightsHighestRoi(),
          // Radar and alpha feed are already surfaced in dedicated panels;
          // here we focus on summarizing emerging opportunities.
        ]);
        if (cancelled) return;
        setTrending(trendingResp.trends ?? []);
        setEmerging(highestRoiResp ?? []);
      } catch {
        if (!cancelled) {
          setError("Unable to load opportunity insights.");
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
        Mining AI insights from the latest signals…
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

  const walletTrends = trending.filter(
    (t) => t.category === "whale_accumulation" || t.category === "wallet_trend",
  );
  const marketAnomalies = trending.filter(
    (t) => t.category === "market_anomaly" || t.category === "spread_anomaly",
  );

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Opportunity Insight Feed
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Condensed view of emerging opportunities and anomalies surfaced by the
        Alpha research layer.
      </p>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Emerging opportunities
          </h4>
          {emerging.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">
              No standout emerging opportunities yet. As the engines see more
              upside, they&apos;ll appear here.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {emerging.slice(0, 5).map((op) => (
                <li
                  key={op.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-slate-100">
                      {op.title}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(op.asset_symbol ?? op.base_symbol ?? op.type) || "—"} ·{" "}
                      {op.type} ·{" "}
                      {op.estimated_roi_percent != null
                        ? `${op.estimated_roi_percent.toFixed(1)}% ROI`
                        : "ROI n/a"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-300">
                    {(op.total_score * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Wallet & market anomalies
          </h4>
          {walletTrends.length === 0 && marketAnomalies.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">
              No strong wallet trends or anomalies detected yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {walletTrends.slice(0, 4).map((t) => (
                <li
                  key={`wallet-${t.key}-${t.timestamp}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-sky-300">
                      Wallet trend: {t.key}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Strength {(t.magnitude * 100).toFixed(0)}%
                    </p>
                  </div>
                </li>
              ))}
              {marketAnomalies.slice(0, 4).map((t) => (
                <li
                  key={`anom-${t.key}-${t.timestamp}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-amber-300">
                      Market anomaly: {t.key}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Magnitude {(t.magnitude * 100).toFixed(0)}%
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

