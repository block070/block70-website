"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import type { StrategySimulatedTradeDto } from "@/lib/trading-strategies-api";

type SimulationChartProps = {
  trades: StrategySimulatedTradeDto[];
  loading?: boolean;
};

/**
 * Display equity curve over time (cumulative profit %).
 */
export function SimulationChart({ trades, loading }: SimulationChartProps) {
  const points = useMemo(() => {
    if (!trades.length) return [];
    const sorted = [...trades].sort(
      (a, b) =>
        new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );
    let cumulative = 0;
    return sorted.map((t) => {
      cumulative += t.profit_percent;
      return {
        t: new Date(t.exit_time).getTime(),
        cumulative,
      };
    });
  }, [trades]);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Equity curve" subtitle="Cumulative profit over time" />
        <div className="h-48 p-4">
          <div className="h-full animate-pulse rounded bg-[var(--b70-border)]" />
        </div>
      </Card>
    );
  }

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader title="Equity curve" subtitle="Cumulative profit over time" />
        <div className="h-48 p-4 flex items-center justify-center text-slate-500 text-sm">
          Run simulation to see equity curve.
        </div>
      </Card>
    );
  }

  const minT = points[0].t;
  const maxT = points[points.length - 1].t || minT;
  const rangeT = maxT - minT || 1;
  const values = points.map((p) => p.cumulative);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 0);
  const rangeV = maxV - minV || 1;

  return (
    <Card>
      <CardHeader title="Equity curve" subtitle="Cumulative profit over time" />
      <div className="h-48 p-4">
        <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="var(--b70-crypto-blue)"
            strokeWidth="2"
            points={points
              .map(
                (p) =>
                  `${((p.t - minT) / rangeT) * 380 + 10},${110 - ((p.cumulative - minV) / rangeV) * 90}`
              )
              .join(" ")}
          />
        </svg>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>{points[0] ? new Date(points[0].t).toLocaleDateString() : ""}</span>
          <span>
            Cumulative: {points[points.length - 1]?.cumulative.toFixed(1) ?? 0}%
          </span>
          <span>
            {points[points.length - 1]
              ? new Date(points[points.length - 1].t).toLocaleDateString()
              : ""}
          </span>
        </div>
      </div>
    </Card>
  );
}
