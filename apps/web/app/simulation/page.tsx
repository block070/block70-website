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
import { StrategyDashboard } from "@/components/strategy/strategy-dashboard";

type TabId = "backtester" | "opportunities";

export default function SimulationPage() {
  const [tab, setTab] = useState<TabId>("backtester");
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

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Simulation hub
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Backtest your saved trading strategies (signal-based) and review
          global opportunity simulations from the scheduler.
        </p>
      </section>

      <div
        className="flex flex-wrap gap-1 rounded-lg border border-[var(--b70-border)] bg-slate-900/40 p-1"
        role="tablist"
      >
        {(
          [
            ["backtester", "Strategy backtester"],
            ["opportunities", "Opportunity simulations"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "rounded-md bg-[var(--b70-crypto-blue)]/20 px-3 py-2 text-sm font-medium text-slate-100 transition-colors"
                : "rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "backtester" && (
        <div className="space-y-4" role="tabpanel">
          <p className="text-xs text-slate-500">
            Authenticated users: select a strategy, run simulation to generate
            trades from signals, then backtest for equity metrics.{" "}
            <Link
              href="/strategies/create"
              className="text-blue-400 hover:text-blue-300"
            >
              Create strategy
            </Link>{" "}
            ·{" "}
            <Link href="/strategies" className="text-blue-400 hover:text-blue-300">
              Legacy rule builder
            </Link>
          </p>
          <StrategyDashboard />
        </div>
      )}

      {tab === "opportunities" && (
        <div className="space-y-6" role="tabpanel">
          {loading ? (
            <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
          ) : error ? (
            <>
              <p className="text-rose-400">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </>
          ) : (
            <>
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
                      No simulated portfolios yet. Run the simulation engine or
                      backtest to populate data.
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
