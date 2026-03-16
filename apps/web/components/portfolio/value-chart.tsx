"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import type { PortfolioDto } from "@/lib/portfolio-api";

function formatUsd(value: number): string {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

type ValueChartProps = {
  portfolio: PortfolioDto | null;
  loading?: boolean;
};

/**
 * Displays historical portfolio value over time.
 * Without a dedicated history API we show a simple placeholder: creation date -> now with current value.
 */
export function ValueChart({ portfolio, loading }: ValueChartProps) {
  const points = useMemo(() => {
    if (!portfolio) return [];
    const created = new Date(portfolio.created_at).getTime();
    const now = Date.now();
    const value = portfolio.total_value_usd ?? 0;
    return [
      { t: created, v: 0 },
      { t: now, v: value },
    ];
  }, [portfolio]);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Portfolio value" subtitle="Over time" />
        <div className="h-48 px-4 pb-4">
          <div className="h-full w-full animate-pulse rounded bg-[var(--b70-border)]" />
        </div>
      </Card>
    );
  }

  if (!portfolio) return null;

  const maxV = Math.max(...points.map((p) => p.v), 1);
  const minT = points[0]?.t ?? 0;
  const maxT = (points[points.length - 1]?.t ?? minT) || 1;
  const rangeT = maxT - minT || 1;

  return (
    <Card>
      <CardHeader title="Portfolio value" subtitle="Over time" />
      <div className="h-48 px-4 pb-4">
        <svg
          className="h-full w-full"
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
        >
          {points.length >= 2 ? (
            <polyline
              fill="none"
              stroke="var(--b70-crypto-blue)"
              strokeWidth="2"
              points={points
                .map(
                  (p) =>
                    `${((p.t - minT) / rangeT) * 380 + 10},${110 - (p.v / maxV) * 90}`,
                )
                .join(" ")}
            />
          ) : (
            <text
              x="200"
              y="60"
              textAnchor="middle"
              className="small fill-slate-500"
            >
              Add wallets and sync to see value history
            </text>
          )}
        </svg>
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>
            {points[0] ? new Date(points[0].t).toLocaleDateString() : "—"}
          </span>
          <span>{formatUsd(portfolio.total_value_usd ?? 0)}</span>
          <span>
            {points[points.length - 1]
              ? new Date(points[points.length - 1].t).toLocaleDateString()
              : "—"}
          </span>
        </div>
      </div>
    </Card>
  );
}
