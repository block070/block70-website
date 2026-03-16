"use client";

import { useEffect, useState } from "react";

import {
  getSimulationPerformance,
  getSimulationTrades,
} from "@/lib/api";

type SimulationTrade = Awaited<ReturnType<typeof getSimulationTrades>>[number];

type SimulationPerformance = Awaited<
  ReturnType<typeof getSimulationPerformance>
>;

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SimulationPanel() {
  const [performance, setPerformance] = useState<SimulationPerformance | null>(
    null,
  );
  const [trades, setTrades] = useState<SimulationTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [perf, tradeList] = await Promise.all([
          getSimulationPerformance().catch(() => null),
          getSimulationTrades({ limit: 20 }).catch(() => []),
        ]);

        if (cancelled) return;

        if (!perf && (!tradeList || !tradeList.length)) {
          setError(
            "No simulation data is available yet. Once Block70 has run trade simulations, performance will appear here.",
          );
        } else {
          if (perf) setPerformance(perf);
          setTrades(tradeList ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load simulation metrics from the backend.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Running strategy simulations and building a synthetic track record…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
        {error}
      </section>
    );
  }

  if (!performance && !trades.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No simulation history yet. As Block70 starts simulating trades on
        detected opportunities, a synthetic portfolio track record will show
        up here.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Simulation Portfolio
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Hypothetical performance if Block70 had followed its own signals with a
        fixed notional position size.
      </p>

      {performance && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              Simulated Portfolio Value
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-50">
              {formatCurrency(
                performance.starting_balance + performance.total_return,
              )}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              From {formatCurrency(performance.starting_balance)} starting
              capital
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Total Return
              </p>
              <p className="mt-1 text-base font-semibold text-emerald-300">
                {formatCurrency(performance.total_return)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Avg trade ROI {formatPercent(performance.average_trade_roi, 1)}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Win Rate
              </p>
              <p className="mt-1 text-base font-semibold text-emerald-300">
                {formatPercent(performance.win_rate * 100, 1)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Max drawdown {formatPercent(performance.max_drawdown, 1)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-slate-200">
            Recent Simulated Trades
          </h4>
          <span className="text-[10px] text-slate-500">
            Last {trades.length} simulations
          </span>
        </div>

        {trades.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            No trade simulations have been recorded yet.
          </p>
        ) : (
          <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80">
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="bg-slate-950/80 text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Token</th>
                  <th className="px-3 py-2 text-left">Entry</th>
                  <th className="px-3 py-2 text-left">Exit</th>
                  <th className="px-3 py-2 text-right">P&L</th>
                  <th className="px-3 py-2 text-right">ROI</th>
                  <th className="px-3 py-2 text-right">Exited</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const positive = t.profit_usd > 0;
                  const pnlColor = positive
                    ? "text-emerald-300"
                    : t.profit_usd < 0
                      ? "text-rose-300"
                      : "text-slate-300";

                  return (
                    <tr
                      key={t.id}
                      className="border-t border-slate-800/80 bg-slate-950/70"
                    >
                      <td className="px-3 py-1.5 align-middle font-mono text-slate-200">
                        {t.token_symbol}
                      </td>
                      <td className="px-3 py-1.5 align-middle text-slate-300">
                        {t.entry_price.toFixed(4)}
                      </td>
                      <td className="px-3 py-1.5 align-middle text-slate-300">
                        {t.exit_price.toFixed(4)}
                      </td>
                      <td
                        className={`px-3 py-1.5 align-middle text-right font-semibold ${pnlColor}`}
                      >
                        {formatCurrency(t.profit_usd)}
                      </td>
                      <td
                        className={`px-3 py-1.5 align-middle text-right ${pnlColor}`}
                      >
                        {formatPercent(t.profit_percent, 1)}
                      </td>
                      <td className="px-3 py-1.5 align-middle text-right text-slate-400">
                        {formatDate(t.exit_timestamp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

