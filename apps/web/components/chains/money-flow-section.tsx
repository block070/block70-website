"use client";

import type { ChainDto } from "@/lib/api";
import { formatChangePct, formatNetflow } from "@/lib/format";

const INSIGHTS: string[] = [
  "Rising DeFi activity and increased stablecoin inflows",
  "Strong capital rotation from L1 alternatives",
  "Growing protocol launches and developer adoption",
  "Bridge inflows and cross-chain migration",
  "New token launches driving TVL expansion",
];

type Props = { chains: ChainDto[] };

export function MoneyFlowSection({ chains }: Props) {
  const top5 = chains.filter((c) => c.netflow_24h > 0).slice(0, 5);

  if (top5.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-50">
        Where Money Is Flowing
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {top5.map((chain, i) => (
          <div
            key={`${chain.name}-${chain.symbol}`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm transition hover:border-slate-700"
          >
            <h3 className="text-sm font-semibold text-slate-50">
              {chain.name}
              <span className="ml-1.5 text-[11px] text-slate-400">
                {chain.symbol}
              </span>
            </h3>
            <p className="mt-2 text-lg font-semibold text-emerald-400">
              {formatNetflow(chain.netflow_24h)}
            </p>
            <p className="text-[11px] text-slate-400">
              {formatChangePct(chain.tvl_24h_change)} TVL change
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {INSIGHTS[i % INSIGHTS.length]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
