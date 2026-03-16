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

type Props = {
  initialOpportunities: Opportunity[];
};

export function InsightsPanel({ initialOpportunities }: Props) {
  const [top, setTop] = useState<TopInsights | null>(null);
  const [trending, setTrending] = useState<Trending[]>([]);
  const [highestRoi, setHighestRoi] = useState<Opportunity[]>([]);
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
        setTop(topResp);
        setTrending(trendingResp.trends ?? []);
        setHighestRoi(highestRoiResp ?? []);
      } catch {
        if (!cancelled) {
          setError("Unable to load insights from the backend.");
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
        Loading insights…
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

  const latestTop = top ?? {
    generated_at: "",
    arbitrage: initialOpportunities.filter((o) => o.type === "arbitrage").slice(0, 3),
    mining: initialOpportunities.filter((o) => o.type === "mining").slice(0, 3),
    wallet: initialOpportunities.filter((o) => o.type === "wallet").slice(0, 3),
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">Insights</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Quick view on where Block70 sees the sharpest edges and emerging trends.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {/* Top Opportunities */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Top Opportunities
          </h4>
          {renderTopList(latestTop)}
        </div>

        {/* Trending Tokens */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Trending Tokens
          </h4>
          {renderTrending(trending)}
        </div>

        {/* Highest ROI */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Highest ROI Opportunities
          </h4>
          {renderHighestRoi(highestRoi)}
        </div>
      </div>
    </section>
  );
}

function renderTopList(top: TopInsights) {
  const items: { label: string; opp: Opportunity }[] = [];

  if (top.arbitrage[0]) {
    items.push({ label: "Arbitrage", opp: top.arbitrage[0] });
  }
  if (top.mining[0]) {
    items.push({ label: "Miner ROI", opp: top.mining[0] });
  }
  if (top.wallet[0]) {
    items.push({ label: "Wallet", opp: top.wallet[0] });
  }

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        No standout opportunities yet. They&apos;ll appear here as the engine finds them.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map(({ label, opp }) => (
        <li key={`${label}-${opp.id}`} className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-xs font-medium text-slate-100 line-clamp-2">{opp.title}</p>
            <p className="text-[11px] text-slate-500">
              {opp.asset_symbol ?? opp.type} ·{" "}
              <span className="text-emerald-300">
                {(opp.total_score * 100).toFixed(0)} score
              </span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function renderTrending(trends: Trending[]) {
  if (!trends || trends.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        No strong trends detected in the last hour.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {trends.slice(0, 5).map((t) => (
        <li key={`${t.category}-${t.key}`} className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {t.category.replace("_", " ")}
            </p>
            <p className="text-xs font-medium text-slate-100">{t.key}</p>
          </div>
          <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.max(10, Math.min(t.magnitude * 100, 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function renderHighestRoi(opportunities: Opportunity[]) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        No ROI leaders yet. As miner ROI and narrative follow trades appear, they&apos;ll be
        highlighted here.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {opportunities.slice(0, 5).map((opp) => (
        <li key={opp.id} className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-100 line-clamp-2">{opp.title}</p>
            <p className="text-[11px] text-slate-500">
              {opp.asset_symbol ?? opp.type}
            </p>
          </div>
          <p className="text-[11px] font-semibold text-emerald-300">
            {opp.estimated_roi_percent != null && !Number.isNaN(opp.estimated_roi_percent)
              ? `${opp.estimated_roi_percent.toFixed(1)}%`
              : "–"}
          </p>
        </li>
      ))}
    </ul>
  );
}

