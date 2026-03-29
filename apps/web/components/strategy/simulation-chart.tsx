"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/card";
import type {
  EquityCurvePoint,
  StrategySimulatedTradeDto,
} from "@/lib/trading-strategies-api";

type SimulationChartProps = {
  trades: StrategySimulatedTradeDto[];
  equityCurve?: EquityCurvePoint[];
  loading?: boolean;
};

type Row = {
  t: string;
  time: number;
  equity?: number;
  cumPct?: number;
  kind?: "equity" | "entry" | "exit";
};

/**
 * Equity curve (USD) from backtest API, with entry/exit markers on the line.
 */
export function SimulationChart({
  trades,
  equityCurve,
  loading,
}: SimulationChartProps) {
  const { chartData, entryRows, exitRows } = useMemo(() => {
    const sortedTrades = [...trades].sort(
      (a, b) =>
        new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );

    if (equityCurve && equityCurve.length > 0) {
      const byTime = new Map<number, Row>();
      for (const p of equityCurve) {
        const time = new Date(p.t).getTime();
        byTime.set(time, {
          t: p.t,
          time,
          equity: p.equity,
          kind: "equity",
        });
      }

      const entries: Row[] = [];
      const exits: Row[] = [];

      for (const tr of sortedTrades) {
        const et = new Date(tr.entry_time).getTime();
        const xt = new Date(tr.exit_time).getTime();
        const eqAtExit =
          byTime.get(xt)?.equity ??
          [...byTime.entries()]
            .filter(([ts]) => ts <= xt)
            .sort((a, b) => a[0] - b[0])
            .at(-1)?.[1].equity;
        const eqAtEntry =
          byTime.get(et)?.equity ??
          [...byTime.entries()]
            .filter(([ts]) => ts <= et)
            .sort((a, b) => a[0] - b[0])
            .at(-1)?.[1].equity;

        if (eqAtEntry != null) {
          entries.push({
            t: tr.entry_time,
            time: et,
            equity: eqAtEntry,
            kind: "entry",
          });
        }
        if (eqAtExit != null) {
          exits.push({
            t: tr.exit_time,
            time: xt,
            equity: eqAtExit,
            kind: "exit",
          });
        }
      }

      const data = [...byTime.values()].sort((a, b) => a.time - b.time);
      return { chartData: data, entryRows: entries, exitRows: exits };
    }

    let cumulative = 0;
    const data: Row[] = [];
    const entries: Row[] = [];
    const exits: Row[] = [];
    for (const tr of sortedTrades) {
      const et = new Date(tr.entry_time).getTime();
      const xt = new Date(tr.exit_time).getTime();
      const atEntry = cumulative;
      entries.push({
        t: tr.entry_time,
        time: et,
        cumPct: atEntry,
        kind: "entry",
      });
      cumulative += tr.profit_percent;
      data.push(
        { t: tr.entry_time, time: et, cumPct: atEntry, kind: "equity" },
        { t: tr.exit_time, time: xt, cumPct: cumulative, kind: "equity" }
      );
      exits.push({
        t: tr.exit_time,
        time: xt,
        cumPct: cumulative,
        kind: "exit",
      });
    }
    data.sort((a, b) => a.time - b.time);
    return { chartData: data, entryRows: entries, exitRows: exits };
  }, [trades, equityCurve]);

  const valueKey = equityCurve && equityCurve.length > 0 ? "equity" : "cumPct";
  const valueLabel =
    equityCurve && equityCurve.length > 0 ? "Equity ($)" : "Cum. trade %";

  if (loading) {
    return (
      <Card>
        <CardHeader title="Equity curve" subtitle="Portfolio equity over time" />
        <div className="h-56 p-4">
          <div className="h-full animate-pulse rounded bg-[var(--b70-border)]" />
        </div>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader title="Equity curve" subtitle="Portfolio equity over time" />
        <div className="h-56 p-4 flex items-center justify-center text-slate-500 text-sm">
          Run simulation and backtest to see the equity curve.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Equity curve" subtitle={valueLabel} />
      <div className="h-56 w-full min-w-0 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => new Date(v).toLocaleDateString()}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={48} />
            <Tooltip
              labelFormatter={(v) => new Date(v as number).toLocaleString()}
              formatter={(v) => [
                typeof v === "number" ? v.toFixed(2) : String(v ?? ""),
                valueLabel,
              ]}
            />
            <Line
              type="stepAfter"
              dataKey={valueKey}
              stroke="var(--b70-crypto-blue, #38bdf8)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            {entryRows.map((r, i) => (
              <ReferenceDot
                key={`e-${r.time}-${i}`}
                x={r.time}
                y={r[valueKey as keyof Row] as number}
                r={4}
                fill="#22c55e"
                stroke="#14532d"
              />
            ))}
            {exitRows.map((r, i) => (
              <ReferenceDot
                key={`x-${r.time}-${i}`}
                x={r.time}
                y={r[valueKey as keyof Row] as number}
                r={4}
                fill="#f97316"
                stroke="#7c2d12"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Entry
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> Exit
          </span>
        </div>
      </div>
    </Card>
  );
}
