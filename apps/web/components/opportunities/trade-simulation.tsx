"use client";

import { useEffect, useState } from "react";

import { getSimulationTrades } from "@/lib/api";
import type { Opportunity } from "@/lib/types";

type Props = {
  opportunity: Opportunity;
};

type SimulationTrade = Awaited<ReturnType<typeof getSimulationTrades>>[number];

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

export function TradeSimulation({ opportunity }: Props) {
  const [trade, setTrade] = useState<SimulationTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch a small window of recent trades, then pick the most recent
        // simulation that matches this opportunity.
        const trades = await getSimulationTrades({ limit: 50 });
        if (cancelled) return;

        const match = trades
          .filter((t) => t.opportunity_id === opportunity.id)
          .sort(
            (a, b) =>
              new Date(b.exit_timestamp).getTime() -
              new Date(a.exit_timestamp).getTime(),
          )[0];

        setTrade(match ?? null);
      } catch {
        if (!cancelled) {
          setError("Unable to load simulated trade for this opportunity.");
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
  }, [opportunity.id]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Simulating a follow trade on this opportunity…
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

  if (!trade) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No simulated trade has been recorded for this opportunity yet. As the
        simulator runs, entry/exit performance will appear here.
      </section>
    );
  }

  const positive = trade.profit_usd > 0;
  const pnlColor = positive
    ? "text-emerald-300"
    : trade.profit_usd < 0
      ? "text-rose-300"
      : "text-slate-300";

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Trade Simulation
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Hypothetical performance if you had taken this signal using the
        simulator&apos;s default rules (fixed notional, +10% take profit,
        -5% stop, 24h timeout).
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            Entry price
          </dt>
          <dd className="mt-0.5 text-sm text-slate-100">
            {trade.entry_price.toFixed(4)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            Exit price
          </dt>
          <dd className="mt-0.5 text-sm text-slate-100">
            {trade.exit_price.toFixed(4)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            Simulated profit
          </dt>
          <dd className={`mt-0.5 text-sm font-semibold ${pnlColor}`}>
            {formatCurrency(trade.profit_usd)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            Profit percent
          </dt>
          <dd className={`mt-0.5 text-sm ${pnlColor}`}>
            {formatPercent(trade.profit_percent, 1)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

