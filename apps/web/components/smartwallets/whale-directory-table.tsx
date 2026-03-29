"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { clsx } from "clsx";

import type { WhaleDirectoryRow } from "@/lib/smartwallets-server";

type Props = {
  rows: WhaleDirectoryRow[];
};

const CHAINS = ["all", "solana", "ethereum", "bitcoin"] as const;

function formatUsd(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function WhaleDirectoryTable({ rows }: Props) {
  const [chain, setChain] = useState<(typeof CHAINS)[number]>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let list = rows;
    if (chain !== "all") {
      list = list.filter((r) => (r.chain || "").toLowerCase() === chain);
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) => r.wallet_address.toLowerCase().includes(needle));
    }
    return list;
  }, [rows, chain, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {CHAINS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChain(c)}
              className={clsx(
                "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize",
                chain === c
                  ? "bg-[var(--b70-crypto-blue)] text-white"
                  : "border border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:border-[var(--b70-crypto-blue)]/40",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by address…"
          className="h-9 w-full max-w-xs rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 text-xs text-[var(--b70-text)] outline-none focus:border-[var(--b70-crypto-blue)]/50"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--b70-border)]">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b border-[var(--b70-border)] bg-[var(--b70-card)] text-[var(--b70-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Address</th>
              <th className="px-3 py-2 font-medium">Chain</th>
              <th className="px-3 py-2 font-medium text-right">Profit / ROI</th>
              <th className="px-3 py-2 font-medium text-right">Win / Rep</th>
              <th className="px-3 py-2 font-medium text-right">Recent opps</th>
              <th className="px-3 py-2 font-medium text-right">Profit USD</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[var(--b70-text-muted)]">
                  No wallets match filters. Adjust chain or search.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const href = `/smartwallets/${r.chain || "solana"}/${encodeURIComponent(r.wallet_address)}`;
                const roi =
                  r.profitability_score != null
                    ? `${(Number(r.profitability_score) * 100).toFixed(0)}%`
                    : r.average_roi != null
                      ? `${(Number(r.average_roi) * 100).toFixed(0)}%`
                      : "—";
                const win =
                  r.reputation_score != null
                    ? `${(Number(r.reputation_score) * 100).toFixed(0)}%`
                    : r.win_rate != null
                      ? `${(Number(r.win_rate) * 100).toFixed(0)}%`
                      : "—";
                return (
                  <tr
                    key={`${r.chain}-${r.wallet_address}`}
                    className="border-b border-[var(--b70-border)]/60 hover:bg-[var(--b70-card)]/40"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={href}
                        className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-crypto-blue)] hover:underline"
                      >
                        {r.wallet_address.slice(0, 10)}…{r.wallet_address.slice(-6)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 uppercase text-[var(--b70-text-muted)]">
                      {r.chain || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-400/90">{roi}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--b70-text)]">{win}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--b70-text-muted)]">
                      {r.recent_opportunity_count ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--b70-text)]">
                      {formatUsd(r.total_profit_usd)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
