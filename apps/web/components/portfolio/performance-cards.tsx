"use client";

import { Card } from "@/components/ui/card";
import type { PortfolioMetricsDto } from "@/lib/portfolio-api";

function formatUsd(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}k`;
  return `$${value.toFixed(2)}`;
}

type PerformanceCardsProps = {
  metrics: PortfolioMetricsDto | null;
  loading?: boolean;
};

export function PerformanceCards({ metrics, loading }: PerformanceCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-5 w-24 animate-pulse rounded bg-[var(--b70-border)]" />
            <div className="mt-2 h-8 w-32 animate-pulse rounded bg-[var(--b70-border)]" />
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const totalValue = metrics.total_value_usd ?? 0;
  const profitLoss = metrics.total_profit_loss ?? 0;
  const bestToken = metrics.best_performing?.[0]?.token_symbol ?? "—";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Total value
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">
          {formatUsd(totalValue)}
        </p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Profit / loss
        </p>
        <p
          className={`mt-1 text-2xl font-semibold ${
            profitLoss >= 0 ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {profitLoss >= 0 ? "+" : ""}
          {formatUsd(profitLoss)}
        </p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Best performing
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">{bestToken}</p>
      </Card>
    </div>
  );
}
