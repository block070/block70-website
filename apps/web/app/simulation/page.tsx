"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSimulationTrades,
  getSimulationPortfolios,
  getSimulationPerformance,
} from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SimulationPage() {
  const [trades, setTrades] = useState<
    Awaited<ReturnType<typeof getSimulationTrades>>
  >([]);
  const [portfolios, setPortfolios] = useState<
    Awaited<ReturnType<typeof getSimulationPortfolios>>
  >([]);
  const [performance, setPerformance] = useState<
    Awaited<ReturnType<typeof getSimulationPerformance>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getSimulationTrades({ limit: 50 }).catch(() => []),
      getSimulationPortfolios().catch(() => []),
      getSimulationPerformance().catch(() => null),
    ])
      .then(([t, p, perf]) => {
        setTrades(Array.isArray(t) ? t : []);
        setPortfolios(Array.isArray(p) ? p : []);
        setPerformance(perf);
      })
      .catch(() => setError("Unable to load simulation data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Trade simulations
        </h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Trade simulations
        </h1>
        <p className="text-rose-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Trade simulations
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Simulated trades and portfolio performance based on opportunity
          signals. Data is populated by the simulation engine.
        </p>
      </section>

      {performance && (
        <Card>
          <CardHeader
            title="Portfolio performance"
            subtitle="Aggregate metrics across simulated trades"
          />
          <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-xs text-slate-500">Starting balance</p>
              <p className="font-mono text-slate-50">
                ${performance.starting_balance?.toLocaleString() ?? "0"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-xs text-slate-500">Total return</p>
              <p className="font-mono text-slate-50">
                {performance.total_return != null
                  ? `${(performance.total_return * 100).toFixed(2)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-xs text-slate-500">Win rate</p>
              <p className="font-mono text-slate-50">
                {performance.win_rate != null
                  ? `${(performance.win_rate * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <p className="text-xs text-slate-500">Avg trade ROI</p>
              <p className="font-mono text-slate-50">
                {performance.average_trade_roi != null
                  ? `${(performance.average_trade_roi * 100).toFixed(2)}%`
                  : "—"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Simulated portfolios"
          subtitle="Portfolios tracked by the simulation engine"
          action={
            <Link
              href="/opportunities"
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Opportunities
            </Link>
          }
        />
        <div className="p-4">
          {portfolios.length === 0 ? (
            <p className="text-xs text-slate-500">
              No simulated portfolios yet. Run the simulation engine or backtest
              to populate data.
            </p>
          ) : (
            <ul className="space-y-2">
              {portfolios.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-200">
                    {p.portfolio_name}
                  </span>
                  <span className="text-slate-400">
                    ${p.starting_balance?.toLocaleString()} → $
                    {p.current_balance?.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Recent simulated trades"
          subtitle="Latest trades from the simulation engine"
        />
        <div className="p-4">
          {trades.length === 0 ? (
            <p className="text-xs text-slate-500">
              No simulated trades yet. Trades appear after the engine runs
              backtests on opportunities.
            </p>
          ) : (
            <ul className="space-y-2">
              {trades.slice(0, 20).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                >
                  <span className="font-mono text-slate-300">
                    {t.token_symbol} @ {t.entry_price?.toFixed(2)} →{" "}
                    {t.exit_price?.toFixed(2)}
                  </span>
                  <span
                    className={
                      (t.profit_percent ?? 0) >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {(t.profit_percent ?? 0) >= 0 ? "+" : ""}
                    {(t.profit_percent ?? 0).toFixed(2)}% ($
                    {(t.profit_usd ?? 0).toFixed(0)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
