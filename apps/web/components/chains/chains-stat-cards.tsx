"use client";

import type { ChainDto } from "@/lib/api";
import { formatCompactUsd, formatNetflow } from "@/lib/format";

type Props = { chains: ChainDto[] };

export function ChainsStatCards({ chains }: Props) {
  const totalChains = chains.length;
  const totalTvl = chains.reduce((s, c) => s + c.tvl, 0);
  const netFlow24h = chains.reduce((s, c) => s + c.netflow_24h, 0);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <StatCard
        label="Total Chains Tracked"
        value={totalChains.toLocaleString()}
        helper="Blockchain ecosystems"
      />
      <StatCard
        label="Total TVL Across Chains"
        value={formatCompactUsd(totalTvl)}
        helper="DeFi total value locked"
      />
      <StatCard
        label="24h Net Flow"
        value={formatNetflow(netFlow24h)}
        helper="Inflow / outflow"
        valueClass={
          netFlow24h > 0
            ? "text-emerald-400"
            : netFlow24h < 0
              ? "text-red-400"
              : "text-slate-50"
        }
      />
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  valueClass?: string;
};

function StatCard({ label, value, helper, valueClass = "text-slate-50" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${valueClass}`}>{value}</p>
      {helper && <p className="mt-1 text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}
