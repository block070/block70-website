"use client";

import { useEffect, useState } from "react";
import { getTopPools, getLiquidityChanges } from "@/lib/api";

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

export function LiquidityPanel() {
  const [pools, setPools] = useState<
    Awaited<ReturnType<typeof getTopPools>>
  >([]);
  const [changes, setChanges] = useState<
    Awaited<ReturnType<typeof getLiquidityChanges>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [poolsRes, changesRes] = await Promise.all([
          getTopPools(15),
          getLiquidityChanges(20),
        ]);
        if (cancelled) return;
        setPools(poolsRes);
        setChanges(changesRes);
      } catch {
        if (!cancelled) setError("Unable to load liquidity data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
        Loading liquidity data…
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

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Liquidity
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Top DEX pools by liquidity and recent liquidity/volume changes.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Top pools by liquidity
          </h4>
          {pools.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">
              No pool data yet. Run the liquidity monitor to populate.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {pools.slice(0, 8).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                >
                  <span className="font-medium text-slate-200">
                    {p.pair}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {p.dex} · {formatUsd(p.liquidity_usd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Largest liquidity changes
          </h4>
          {changes.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">
              No liquidity change signals yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {changes.slice(0, 8).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                >
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      c.signal_type === "liquidity_increase"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : c.signal_type === "liquidity_drop"
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {c.signal_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-slate-300">
                    {c.token_symbol ?? "–"}
                    {c.metadata && typeof c.metadata.change_percent === "number"
                      ? ` ${c.metadata.change_percent > 0 ? "+" : ""}${c.metadata.change_percent.toFixed(1)}%`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
