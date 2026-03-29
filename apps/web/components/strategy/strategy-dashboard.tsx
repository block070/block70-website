"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getTradingStrategies,
  getStrategyBacktest,
  getStrategyTrades,
  runStrategySimulation,
  runStrategyBacktest,
  type TradingStrategyDto,
  type StrategyBacktestDto,
  type StrategySimulatedTradeDto,
  type EquityCurvePoint,
} from "@/lib/trading-strategies-api";
import { BacktestResults } from "./backtest-results";
import { SimulationChart } from "./simulation-chart";
import { StrategyInsightsPanel } from "./strategy-insights-panel";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Share2, BarChart3 } from "lucide-react";

function normalizeBacktest(
  b: StrategyBacktestDto | null
): StrategyBacktestDto | null {
  if (!b) return null;
  return {
    ...b,
    total_return_pct: b.total_return_pct ?? 0,
    equity_curve: b.equity_curve ?? [],
  };
}

export function StrategyDashboard() {
  const [strategies, setStrategies] = useState<TradingStrategyDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [backtest, setBacktest] = useState<StrategyBacktestDto | null>(null);
  const [equityCurve, setEquityCurve] = useState<EquityCurvePoint[]>([]);
  const [trades, setTrades] = useState<StrategySimulatedTradeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const loadStrategies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTradingStrategies();
      setStrategies(data);
      if (data.length && !selectedId) setSelectedId(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setBacktest(null);
      setTrades([]);
      setEquityCurve([]);
      return;
    }
    Promise.all([
      getStrategyBacktest(selectedId).catch(() => null),
      getStrategyTrades(selectedId).catch(() => []),
    ]).then(([b, t]) => {
      const nb = normalizeBacktest(b);
      setBacktest(nb);
      setEquityCurve(nb?.equity_curve ?? []);
      setTrades(t || []);
    });
  }, [selectedId]);

  const handleRunBacktest = async () => {
    if (!selectedId) return;
    setRunning(true);
    try {
      const run = await runStrategyBacktest(selectedId, {
        refresh_trades: false,
      });
      setBacktest(normalizeBacktest(run.metrics));
      setTrades(run.trades);
      setEquityCurve(run.equity_curve.length ? run.equity_curve : run.metrics.equity_curve ?? []);
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!selectedId) return;
    setRunning(true);
    try {
      await runStrategySimulation(selectedId);
      const run = await runStrategyBacktest(selectedId, {
        refresh_trades: false,
      });
      setBacktest(normalizeBacktest(run.metrics));
      setTrades(run.trades);
      setEquityCurve(run.equity_curve.length ? run.equity_curve : run.metrics.equity_curve ?? []);
    } catch {
      // ignore
    } finally {
      setRunning(false);
    }
  };

  if (error) {
    return (
      <Card>
        <div className="p-4 text-rose-400">
          {error}. Log in to view your trading strategies.
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          <Link href="/login">
            <Button>Log in</Button>
          </Link>
          <Link href="/strategies/create">
            <Button variant="outline">Create strategy</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/strategies/create">
          <Button>Create strategy</Button>
        </Link>
        <Link href="/strategies/leaderboard">
          <Button variant="outline">
            <BarChart3 className="mr-1 h-4 w-4" />
            Leaderboard
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      ) : strategies.length === 0 ? (
        <Card>
          <div className="p-6 text-center text-slate-500">
            No trading strategies yet. Create one to define entry/exit rules and
            run backtests.
          </div>
          <div className="p-4 flex justify-center">
            <Link href="/strategies/create">
              <Button>Create strategy</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Your strategies" subtitle="Select one to view backtest and trades" />
            <div className="p-4 flex flex-wrap gap-2">
              {strategies.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      selectedId === s.id
                        ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/10 text-slate-100"
                        : "border-[var(--b70-border)] text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {s.strategy_name}
                  </button>
                  <Link href={`/strategies/share/${s.id}`}>
                    <Button variant="ghost" className="p-1">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          {selectedId && (
            <>
              <div className="flex gap-2">
                <Button
                  onClick={handleRunBacktest}
                  disabled={running}
                  variant="outline"
                >
                  <Play className="mr-1 h-4 w-4" />
                  {running ? "Running…" : "Run backtest"}
                </Button>
                <Button
                  onClick={handleRunSimulation}
                  disabled={running}
                  variant="outline"
                >
                  Run simulation
                </Button>
              </div>
              <BacktestResults backtest={backtest} trades={trades} loading={false} />
              <SimulationChart
                trades={trades}
                equityCurve={equityCurve}
                loading={false}
              />
              <StrategyInsightsPanel trades={trades} backtest={backtest} />
            </>
          )}
        </>
      )}
    </div>
  );
}
