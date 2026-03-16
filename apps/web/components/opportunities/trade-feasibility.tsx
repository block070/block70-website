"use client";

import type { Opportunity } from "@/lib/types";

const IMPACT_FACTOR = 15; // matches backend LiquiditySimulator.DEFAULT_IMPACT_FACTOR

type Props = { opportunity: Opportunity };

function formatPercent(value: number, digits = 2): string {
  if (Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatUsd(value: number): string {
  if (Number.isNaN(value)) return "–";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

export function TradeFeasibility({ opportunity }: Props) {
  if (opportunity.type !== "arbitrage") return null;

  const raw = opportunity.raw_payload as Record<string, unknown> | undefined;
  const signal = raw?.signal as Record<string, unknown> | undefined;
  const value = signal?.value as Record<string, unknown> | undefined;

  const estimatedSlippage =
    typeof value?.estimated_slippage_percent === "number"
      ? value.estimated_slippage_percent
      : null;
  const minLiquidityUsd =
    typeof value?.min_liquidity_usd === "number" ? value.min_liquidity_usd : null;
  const liquidityScoreFromSignal =
    typeof value?.liquidity_score === "number" ? value.liquidity_score : null;
  const spreadPercent =
    typeof value?.spread_percent === "number" ? value.spread_percent : null;
  const estimatedFeesPercent =
    typeof value?.estimated_fees_percent === "number"
      ? value.estimated_fees_percent : null;

  const liquidityScore =
    liquidityScoreFromSignal ?? opportunity.liquidity_score ?? null;
  const netEdgePercent =
    spreadPercent != null && estimatedFeesPercent != null
      ? spreadPercent - estimatedFeesPercent
      : null;
  const maxProfitableTradeSize =
    netEdgePercent != null &&
    minLiquidityUsd != null &&
    netEdgePercent > 0 &&
    IMPACT_FACTOR > 0
      ? (netEdgePercent / 100) * minLiquidityUsd / (IMPACT_FACTOR / 100)
      : null;

  const hasAny =
    estimatedSlippage != null ||
    liquidityScore != null ||
    maxProfitableTradeSize != null;

  if (!hasAny) return null;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-50">Trade Feasibility</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Execution feasibility for this arbitrage based on pool liquidity and
        estimated slippage.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {estimatedSlippage != null && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Estimated slippage
            </span>
            <span className="text-sm font-medium text-slate-200">
              {formatPercent(estimatedSlippage)}
            </span>
          </div>
        )}
        {maxProfitableTradeSize != null && maxProfitableTradeSize > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Max profitable trade size
            </span>
            <span className="text-sm font-medium text-emerald-300">
              {formatUsd(maxProfitableTradeSize)}
            </span>
          </div>
        )}
        {liquidityScore != null && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Liquidity score
            </span>
            <span className="text-sm font-medium text-slate-200">
              {formatPercent(liquidityScore * 100, 0)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
