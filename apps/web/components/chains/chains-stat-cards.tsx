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
        label="Ecosystems tracked"
        value={totalChains.toLocaleString()}
        helper="From live DeFiLlama chain TVL"
      />
      <StatCard
        label="Combined TVL (sample)"
        value={formatCompactUsd(totalTvl)}
        helper="Sum of rows on this page — not full-market exhaustive"
      />
      <StatCard
        label="Implied 24h net flow (sum)"
        value={formatNetflow(netFlow24h)}
        helper="Σ(TVL × 24h %) — modeled liquidity rotation"
        valueClass={
          netFlow24h > 0
            ? "text-emerald-400"
            : netFlow24h < 0
              ? "text-rose-400"
              : "text-[var(--b70-text)]"
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

function StatCard({ label, value, helper, valueClass = "text-[var(--b70-text)]" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-xl font-semibold ${valueClass}`}>{value}</p>
      {helper && <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">{helper}</p>}
    </div>
  );
}
