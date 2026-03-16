"use client";

import { useEffect, useState } from "react";

import type { AlphaRankedOpportunity } from "@/lib/types";
import { getAlphaTop } from "@/lib/api";

function formatScore(score: number | null | undefined, digits = 0): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(digits)}%`;
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

export function AlphaLeaderboard() {
  const [entries, setEntries] = useState<AlphaRankedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getAlphaTop();
        if (cancelled) return;
        setEntries(data ?? []);
      } catch {
        if (!cancelled) {
          setError("Unable to load the alpha leaderboard.");
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
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Ranking opportunities by alpha score…
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

  if (!entries.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No alpha leaderboard is available yet. As Block70 learns more about the
        current market, the top ranked opportunities will appear here.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">Alpha Leaderboard</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Top opportunities across arbitrage, miners, wallets, narratives, and
        airdrops ranked by Block70&apos;s alpha meta-score.
      </p>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Token</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Alpha Score</th>
              <th className="px-3 py-2 text-right">Est. ROI</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 5).map((entry) => {
              const opp = entry.opportunity;
              const token = opp.asset_symbol ?? opp.base_symbol ?? opp.type;

              return (
                <tr
                  key={opp.id}
                  className="border-t border-slate-800/80 bg-slate-950/70"
                >
                  <td className="px-3 py-2 align-middle text-slate-400">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 text-[10px] font-semibold text-emerald-300">
                      {entry.rank_position}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-100">
                    <span className="line-clamp-2">{opp.title}</span>
                  </td>
                  <td className="px-3 py-2 align-middle font-mono text-slate-200">
                    {token}
                  </td>
                  <td className="px-3 py-2 align-middle capitalize text-slate-300">
                    {opp.type}
                  </td>
                  <td className="px-3 py-2 align-middle text-right font-semibold text-emerald-300">
                    {formatScore(entry.alpha_score, 0)}
                  </td>
                  <td className="px-3 py-2 align-middle text-right text-emerald-200">
                    {formatPercent(opp.estimated_roi_percent ?? null, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

