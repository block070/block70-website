"use client";

import { useEffect, useState } from "react";

import type { AlphaRankedOpportunity } from "@/lib/types";
import { getAlphaTop } from "@/lib/api";

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatScore(score: number | null | undefined, digits = 0): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(digits)}%`;
}

export function AlphaOfTheHour() {
  const [entry, setEntry] = useState<AlphaRankedOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAlphaTop();
        if (cancelled) return;
        setEntry(data && data.length ? data[0] : null);
      } catch {
        if (!cancelled) {
          setError("Unable to load Alpha of the Hour.");
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
      <section className="rounded-xl border border-emerald-700/60 bg-slate-950/80 p-4 text-xs text-slate-400">
        Surfacing the sharpest alpha right now…
      </section>
    );
  }

  if (error || !entry) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        {error ??
          "No standout alpha has been ranked yet. As Block70 sees more opportunities, the top signal will appear here."}
      </section>
    );
  }

  const opp = entry.opportunity;
  const token = opp.asset_symbol ?? opp.base_symbol ?? opp.type;

  return (
    <section className="relative overflow-hidden rounded-xl border border-emerald-500/70 bg-gradient-to-r from-slate-950 via-slate-950 to-emerald-950/40 p-5 shadow-lg shadow-emerald-500/25">
      <div className="pointer-events-none absolute -right-16 -top-24 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Alpha of the Hour
          </p>
          <h2 className="text-lg font-semibold text-slate-50 line-clamp-2">
            {opp.title}
          </h2>
          <p className="text-[11px] text-slate-400">
            {opp.type} · {opp.chain ?? "multi-chain"} ·{" "}
            <span className="capitalize">{opp.status}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Alpha Score
            </p>
            <p className="text-2xl font-semibold text-emerald-300">
              {formatScore(entry.alpha_score, 0)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
            <div>
              <span className="text-slate-500">Token</span>{" "}
              <span className="font-semibold text-slate-100">{token}</span>
            </div>
            <div>
              <span className="text-slate-500">Est. ROI</span>{" "}
              <span className="font-semibold text-emerald-300">
                {formatPercent(opp.estimated_roi_percent ?? null, 1)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Confidence</span>{" "}
              <span className="font-semibold text-emerald-300">
                {formatScore(opp.confidence_score, 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Freshness</span>{" "}
              <span className="font-semibold text-emerald-200">
                {formatScore(opp.freshness_score, 0)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-3 text-[11px] text-slate-300">
        <p className="line-clamp-3">
          {opp.summary ??
            "Composite opportunity surfaced by the Block70 Alpha Engine across upside, confidence, freshness, and liquidity."}
        </p>
      </div>
    </section>
  );
}

