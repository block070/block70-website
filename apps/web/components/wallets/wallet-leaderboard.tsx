"use client";

import { useEffect, useState } from "react";

import type { WalletLeaderboardEntry } from "@/lib/types";
import { getWalletLeaderboard } from "@/lib/api";

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

type Props = {
  initialData?: WalletLeaderboardEntry[]; // reserved for future server prefetch
};

export function WalletLeaderboard({ initialData }: Props) {
  const [rows, setRows] = useState<WalletLeaderboardEntry[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData && initialData.length > 0) return;

    let cancelled = false;

    async function load() {
      try {
        const data = await getWalletLeaderboard();
        if (cancelled) return;
        setRows(data);
      } catch {
        if (!cancelled) {
          setError(
            "Unable to load the smart wallet leaderboard from the backend.",
          );
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
  }, [initialData]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Loading smart wallet leaderboard…
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

  if (!rows.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No smart wallet profiles are available yet. As Block70 observes more
        wallet-follow opportunities, high-performing addresses will appear
        here.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 shadow-lg shadow-black/40">
      <header className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-950 to-emerald-900/30 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            Smart Wallet Leaderboard
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Ranked by realized ROI, win-rate, and recent on-chain opportunity
            flow.
          </p>
        </div>
        <div className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          Top {rows.length} wallets
        </div>
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-slate-950/40" />
        <table className="min-w-full border-t border-slate-800 text-xs">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">Wallet</th>
              <th className="px-4 py-2 text-right">Win-Rate</th>
              <th className="px-4 py-2 text-right">Average ROI</th>
              <th className="px-4 py-2 text-right">Total Profit</th>
              <th className="px-4 py-2 text-right">Recent Activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isTop = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;

              const accentBorder = isTop
                ? "border-emerald-500/70"
                : isSecond
                  ? "border-emerald-400/50"
                  : isThird
                    ? "border-emerald-300/40"
                    : "border-transparent";

              const accentBg = isTop
                ? "bg-emerald-500/10"
                : isSecond
                  ? "bg-emerald-500/5"
                  : isThird
                    ? "bg-emerald-500/0"
                    : "bg-transparent";

              const shortAddress =
                row.wallet_address.length > 12
                  ? `${row.wallet_address.slice(0, 6)}…${row.wallet_address.slice(-4)}`
                  : row.wallet_address;

              return (
                <tr
                  key={row.wallet_address}
                  className={`border-t border-slate-900/60 ${accentBg}`}
                >
                  <td className="px-4 py-2 align-middle text-[11px] text-slate-400">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${accentBorder} bg-slate-950/80 text-[10px] font-semibold text-emerald-200`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle font-mono text-[11px] text-slate-100">
                    {shortAddress}
                  </td>
                  <td className="px-4 py-2 align-middle text-right text-slate-100">
                    <span className="font-medium text-emerald-300">
                      {formatPercent(row.win_rate * 100, 1)}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle text-right text-slate-100">
                    <span
                      className={`font-medium ${
                        row.average_roi >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {formatPercent(row.average_roi, 1)}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle text-right text-slate-100">
                    <span
                      className={`font-medium ${
                        row.total_profit_usd >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {formatCurrency(row.total_profit_usd)}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle text-right text-slate-300">
                    {row.recent_opportunity_count}
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

