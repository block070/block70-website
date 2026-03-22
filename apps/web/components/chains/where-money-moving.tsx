"use client";

import type { ChainDto } from "@/lib/api";
import { formatNetflow } from "@/lib/format";

function getBadge(chain: ChainDto, rank: number): string {
  if (chain.tvl_24h_change > 5) return "🚀";
  if (chain.tvl_24h_change < -5) return "⚠️";
  if (rank <= 3) return "🔥";
  return "📈";
}

const PLACEHOLDERS: Record<string, string> = {
  positive_high: "DeFi activity surging with new protocol deployments",
  positive: "Growing interest from institutional and retail capital",
  negative: "Investors shifting to higher-yield alternatives",
  neutral: "Steady activity with moderate rotation",
};

type Props = { chains: ChainDto[] };

export function WhereMoneyMoving({ chains }: Props) {
  const top = chains
    .slice()
    .sort((a, b) => b.netflow_24h - a.netflow_24h)
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-slate-950/80 p-6 shadow-xl">
      <h2 className="mb-5 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
        Where Money Is Moving Right Now
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {top.map((chain, i) => {
          const badge = getBadge(chain, i + 1);
          const placeholder =
            chain.netflow_24h > 0
              ? chain.tvl_24h_change > 5
                ? PLACEHOLDERS.positive_high
                : PLACEHOLDERS.positive
              : chain.netflow_24h < 0
                ? PLACEHOLDERS.negative
                : PLACEHOLDERS.neutral;

          return (
            <div
              key={`${chain.name}-${chain.symbol}`}
              className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 shadow-lg transition hover:border-slate-600 hover:shadow-emerald-500/5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-50">
                  {chain.name}
                  <span className="ml-1.5 text-sm font-normal text-slate-400">
                    {chain.symbol}
                  </span>
                </h3>
                <span className="text-lg" title={badge === "🔥" ? "Hot" : badge === "🚀" ? "Growing" : "Declining"}>
                  {badge}
                </span>
              </div>
              <p
                className={`mt-2 text-xl font-bold ${
                  chain.netflow_24h >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatNetflow(chain.netflow_24h)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {placeholder}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
