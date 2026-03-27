"use client";

import type { ChainDto } from "@/lib/api";
import { chainsCompareSlug } from "@/lib/chains-compare-slug";
import { formatNetflow } from "@/lib/format";
import { TrendingDown, TrendingUp } from "lucide-react";

const RAIL_LIMIT = 6;

type Props = { chains: ChainDto[] };

export function ChainsCapitalFlowRails({ chains }: Props) {
  const gainers = [...chains]
    .filter((c) => c.netflow_24h > 0)
    .sort((a, b) => b.netflow_24h - a.netflow_24h)
    .slice(0, RAIL_LIMIT);

  const losers = [...chains]
    .filter((c) => c.netflow_24h < 0)
    .sort((a, b) => a.netflow_24h - b.netflow_24h)
    .slice(0, RAIL_LIMIT);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Gaining liquidity</h2>
        </div>
        <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
          Chains with positive implied 24h TVL flow (derived from TVL and 24h % change).
        </p>
        {gainers.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--b70-text-muted)]">No positive netflow in this set.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {gainers.map((c) => (
              <li
                key={chainsCompareSlug(c.name)}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate font-medium text-[var(--b70-text)]">{c.name}</span>
                <span className="shrink-0 tabular-nums font-medium text-emerald-400">
                  {formatNetflow(c.netflow_24h)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.05] p-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-rose-400" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Losing liquidity</h2>
        </div>
        <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
          Chains with negative implied flow — capital rotating elsewhere in the snapshot.
        </p>
        {losers.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--b70-text-muted)]">No negative netflow in this set.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {losers.map((c) => (
              <li
                key={chainsCompareSlug(c.name)}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate font-medium text-[var(--b70-text)]">{c.name}</span>
                <span className="shrink-0 tabular-nums font-medium text-rose-400">
                  {formatNetflow(c.netflow_24h)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[10px] text-[var(--b70-text-muted)] lg:col-span-2">
        Source chain TVL from{" "}
        <a
          href="https://defillama.com/"
          target="_blank"
          rel="noreferrer"
          className="text-crypto-blue hover:underline"
        >
          DeFiLlama
        </a>
        . Flow is modeled, not chain-level bridge telemetry — see methodology on the leaderboard below.
      </p>
    </section>
  );
}
