"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

type Props = {
  symbol: string;
  currentPriceUsd: number;
};

export function RoiCalculator({ symbol, currentPriceUsd }: Props) {
  const [investUsd, setInvestUsd] = useState("1000");
  const [entry, setEntry] = useState(
    currentPriceUsd > 0 ? String(currentPriceUsd.toFixed(2)) : "1"
  );
  const [target, setTarget] = useState(
    currentPriceUsd > 0 ? String((currentPriceUsd * 1.1).toFixed(2)) : "2"
  );

  const parsed = useMemo(() => {
    const inv = Math.max(0, parseFloat(investUsd) || 0);
    const e = Math.max(1e-12, parseFloat(entry) || 0);
    const t = Math.max(0, parseFloat(target) || 0);
    const coins = inv / e;
    const valueAtTarget = coins * t;
    const pnl = valueAtTarget - inv;
    const pct = inv > 0 ? (pnl / inv) * 100 : 0;
    return { inv, valueAtTarget, pnl, pct };
  }, [investUsd, entry, target]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        ROI calculator
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Hypothetical P&amp;L if {symbol} moves from your entry to a target price.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-[11px] text-slate-400">
          Investment (USD)
          <input
            type="text"
            inputMode="decimal"
            value={investUsd}
            onChange={(e) => setInvestUsd(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block text-[11px] text-slate-400">
          Entry price (USD)
          <input
            type="text"
            inputMode="decimal"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block text-[11px] text-slate-400">
          Target price (USD)
          <input
            type="text"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
      </div>
      <div className="mt-4 rounded-lg border border-slate-700/80 bg-slate-950/50 p-3 text-sm">
        <p className="text-slate-400">Value at target</p>
        <p className="text-lg font-semibold text-slate-100">
          {formatPrice(parsed.valueAtTarget)}
        </p>
        <p className="mt-2 text-slate-400">Est. P&amp;L</p>
        <p
          className={
            parsed.pnl >= 0 ? "text-lg font-semibold text-emerald-400" : "text-lg font-semibold text-red-400"
          }
        >
          {parsed.pnl >= 0 ? "+" : ""}
          {formatPrice(parsed.pnl)} ({parsed.pct >= 0 ? "+" : ""}
          {parsed.pct.toFixed(2)}%)
        </p>
      </div>
    </section>
  );
}
