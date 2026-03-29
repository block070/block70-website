"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import type { StrategySimulatedTradeDto } from "@/lib/trading-strategies-api";
import type { StrategyBacktestDto } from "@/lib/trading-strategies-api";

type StrategyInsightsPanelProps = {
  trades: StrategySimulatedTradeDto[];
  backtest: StrategyBacktestDto | null;
};

/**
 * Display best performing tokens, most profitable signals (tokens), risk metrics.
 */
export function StrategyInsightsPanel({
  trades,
  backtest,
}: StrategyInsightsPanelProps) {
  const bestTokens = useMemo(() => {
    const byToken: Record<string, { total: number; count: number }> = {};
    for (const t of trades) {
      const sym = t.token_symbol;
      if (!byToken[sym]) byToken[sym] = { total: 0, count: 0 };
      byToken[sym].total += t.profit_percent;
      byToken[sym].count += 1;
    }
    return Object.entries(byToken)
      .map(([symbol, data]) => ({
        symbol,
        avgProfit: data.total / data.count,
        count: data.count,
      }))
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 5);
  }, [trades]);

  const wins = useMemo(
    () => trades.filter((t) => t.profit_percent > 0).length,
    [trades]
  );
  const losses = trades.length - wins;

  return (
    <Card>
      <CardHeader
        title="Strategy insights"
        subtitle="Best performing tokens, risk metrics"
      />
      <div className="p-4 space-y-4">
        {backtest && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Win rate</p>
              <p className="text-lg font-semibold text-slate-100">
                {(backtest.win_rate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total return</p>
              <p
                className={`text-lg font-semibold ${
                  (backtest.total_return_pct ?? 0) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {(backtest.total_return_pct ?? 0) >= 0 ? "+" : ""}
                {(backtest.total_return_pct ?? 0).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Max drawdown</p>
              <p className="text-lg font-semibold text-rose-400">
                {backtest.max_drawdown.toFixed(2)}%
              </p>
            </div>
          </div>
        )}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            Best performing tokens
          </h4>
          {bestTokens.length === 0 ? (
            <p className="text-xs text-slate-500">No trades yet.</p>
          ) : (
            <ul className="space-y-1">
              {bestTokens.map(({ symbol, avgProfit, count }) => (
                <li
                  key={symbol}
                  className="flex justify-between text-sm"
                >
                  <span className="font-medium text-slate-200">{symbol}</span>
                  <span className={avgProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {avgProfit >= 0 ? "+" : ""}
                    {avgProfit.toFixed(2)}% ({count} trades)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-xs text-slate-500">
          Wins: {wins} · Losses: {losses}
        </div>
      </div>
    </Card>
  );
}
