"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { getSimulationTrades } from "@/lib/api";

const OUTCOMES_KEY = "b70-opportunity-outcomes";

type LocalOutcome = { id: number; win: boolean; at: string; roiPct?: number };

function readLocalOutcomes(): LocalOutcome[] {
  try {
    const raw = localStorage.getItem(OUTCOMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is LocalOutcome =>
          x != null &&
          typeof x === "object" &&
          "id" in x &&
          typeof (x as LocalOutcome).id === "number",
      )
      .map((x) => ({
        id: x.id,
        win: Boolean(x.win),
        at: typeof x.at === "string" ? x.at : "",
        roiPct: typeof x.roiPct === "number" ? x.roiPct : undefined,
      }));
  } catch {
    return [];
  }
}

export function OpportunitiesPerformanceStrip() {
  const [simWinRate, setSimWinRate] = useState<number | null>(null);
  const [simAvgRoi, setSimAvgRoi] = useState<number | null>(null);
  const [simCount, setSimCount] = useState(0);
  const [localStats, setLocalStats] = useState<{ n: number; winRate: number | null }>({
    n: 0,
    winRate: null,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const trades = await getSimulationTrades({ limit: 80 });
        if (cancelled) return;
        if (!trades.length) {
          setSimCount(0);
          setSimWinRate(null);
          setSimAvgRoi(null);
          return;
        }
        const wins = trades.filter((t) => t.profit_percent > 0).length;
        setSimCount(trades.length);
        setSimWinRate(Math.round((wins / trades.length) * 100));
        const avg =
          trades.reduce((a, t) => a + t.profit_percent, 0) / trades.length;
        setSimAvgRoi(Number.isFinite(avg) ? Math.round(avg * 10) / 10 : null);
      } catch {
        if (!cancelled) setError("Simulation history unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const o = readLocalOutcomes();
    if (!o.length) {
      setLocalStats({ n: 0, winRate: null });
      return;
    }
    const wins = o.filter((x) => x.win).length;
    setLocalStats({
      n: o.length,
      winRate: Math.round((wins / o.length) * 100),
    });
  }, []);

  const hasAnything = simCount > 0 || localStats.n > 0;

  const summary = useMemo(() => {
    if (!hasAnything && !error)
      return "No closed simulation trades in view yet. As you run trade simulations from opportunity pages, stats aggregate here.";
    return null;
  }, [hasAnything, error]);

  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--b70-text)]">Track record (experimental)</h2>
      </div>
      <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
        Backfilled from recent simulation trades API. Local outcomes (if you log them in-app later) merge
        for a personal win rate—no audited fund performance.
      </p>
      {error ? (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300/90">{error}</p>
      ) : null}
      {summary ? (
        <p className="mt-3 text-xs text-[var(--b70-text-muted)]">{summary}</p>
      ) : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[10px] uppercase text-[var(--b70-text-muted)]">Sim trades (sample)</dt>
            <dd className="font-[family-name:var(--font-jetbrains)] text-lg font-semibold text-[var(--b70-text)]">
              {simCount}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[var(--b70-text-muted)]">Sim win rate</dt>
            <dd className="font-[family-name:var(--font-jetbrains)] text-lg font-semibold text-[var(--b70-text)]">
              {simWinRate != null ? `${simWinRate}%` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase text-[var(--b70-text-muted)]">Avg sim P&amp;L %</dt>
            <dd className="font-[family-name:var(--font-jetbrains)] text-lg font-semibold text-[var(--b70-text)]">
              {simAvgRoi != null ? `${simAvgRoi > 0 ? "+" : ""}${simAvgRoi}%` : "—"}
            </dd>
          </div>
          {localStats.n > 0 ? (
            <div className="sm:col-span-3">
              <dt className="text-[10px] uppercase text-[var(--b70-text-muted)]">Local logged outcomes</dt>
              <dd className="text-sm text-[var(--b70-text)]">
                {localStats.n} marks · {localStats.winRate != null ? `${localStats.winRate}% wins` : "—"}
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}
