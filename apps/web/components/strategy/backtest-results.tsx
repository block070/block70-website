"use client";

import { Card, CardHeader } from "@/components/ui/card";
import type {
  StrategyBacktestDto,
  StrategySimulatedTradeDto,
} from "@/lib/trading-strategies-api";

type BacktestResultsProps = {
  backtest: StrategyBacktestDto | null;
  trades: StrategySimulatedTradeDto[];
  loading?: boolean;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function BacktestResults({
  backtest,
  trades,
  loading,
}: BacktestResultsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader title="Backtest results" subtitle="Win rate and trade history" />
        <div className="p-4">
          <div className="h-24 animate-pulse rounded bg-[var(--b70-border)]" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Backtest results" subtitle="Win rate and trade history" />
      <div className="p-4 space-y-4">
        {backtest ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-slate-500">Win rate</p>
                <p className="text-lg font-semibold text-slate-100">
                  {formatPercent(backtest.win_rate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total trades</p>
                <p className="text-lg font-semibold text-slate-100">
                  {backtest.total_trades}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg profit</p>
                <p className="text-lg font-semibold text-emerald-400">
                  {backtest.average_profit >= 0 ? "+" : ""}
                  {backtest.average_profit.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Max drawdown</p>
                <p className="text-lg font-semibold text-rose-400">
                  {backtest.max_drawdown.toFixed(2)}%
                </p>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Trade history</h4>
              {trades.length === 0 ? (
                <p className="text-xs text-slate-500">No simulated trades yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 text-left">
                        <th className="py-1 pr-2">Token</th>
                        <th className="py-1 pr-2">Entry</th>
                        <th className="py-1 pr-2">Exit</th>
                        <th className="py-1 text-right">Profit %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 15).map((t) => (
                        <tr key={t.id} className="border-t border-[var(--b70-border)]">
                          <td className="py-1 pr-2 font-medium text-slate-200">
                            {t.token_symbol}
                          </td>
                          <td className="py-1 pr-2 text-slate-400">
                            ${t.entry_price.toFixed(4)}
                          </td>
                          <td className="py-1 pr-2 text-slate-400">
                            ${t.exit_price.toFixed(4)}
                          </td>
                          <td
                            className={`py-1 text-right ${
                              t.profit_percent >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {t.profit_percent >= 0 ? "+" : ""}
                            {t.profit_percent.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Run a backtest to see results.
          </p>
        )}
      </div>
    </Card>
  );
}
