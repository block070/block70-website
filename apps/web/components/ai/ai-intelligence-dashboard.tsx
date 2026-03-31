"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";
import {
  getAIIntelligenceOpportunities,
  postAIIntelligenceAnalyze,
  type AIIntelligenceOpportunity,
  type AIIntelligenceRisk,
  type AIIntelligenceTimeframe,
} from "@/lib/ai-intelligence-api";
import { formatChangePct, formatCompactUsd } from "@/lib/format";

const SIGNAL_ORDER = [
  "momentum",
  "volume",
  "social",
  "dev",
  "whales",
  "sentiment",
  "risk",
] as const;

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const deg = (pct / 100) * 360;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full bg-[var(--b70-border)]/40"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--b70-crypto-blue) ${deg}deg, transparent ${deg}deg)`,
        }}
      />
      <div
        className="relative flex items-center justify-center rounded-full bg-[var(--b70-card)]"
        style={{ width: size - 10, height: size - 10 }}
      >
        <span className="text-sm font-semibold tabular-nums text-[var(--b70-fg)]">
          {Math.round(pct)}
        </span>
      </div>
    </div>
  );
}

function SignalBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(20, value));
  const w = (v / 20) * 100;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[11px] uppercase tracking-wide text-[var(--b70-muted)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--b70-fg)]">{v.toFixed(1)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--b70-border)]/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--b70-crypto-blue)]/80 to-[var(--b70-crypto-blue)]"
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

export function AIIntelligenceDashboard() {
  const formId = useId();
  const [timeframe, setTimeframe] = useState<AIIntelligenceTimeframe>("24h");
  const [minMcap, setMinMcap] = useState<string>("");
  const [risk, setRisk] = useState<AIIntelligenceRisk | "">("");
  const [limit] = useState(12);
  const [rows, setRows] = useState<AIIntelligenceOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState<{
    summary: string;
    key_trends: string[];
    risks: string[];
  } | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  const minMcapNum = useMemo(() => {
    const n = parseFloat(minMcap.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [minMcap]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAIIntelligenceOpportunities({
        limit,
        timeframe,
        minMcap: minMcapNum,
        risk: risk || undefined,
      });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [limit, timeframe, minMcapNum, risk]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setAnalyzeLoading(true);
    try {
      const res = await postAIIntelligenceAnalyze(q);
      setAnalysis({
        summary: res.summary,
        key_trends: res.key_trends ?? [],
        risks: res.risks ?? [],
      });
    } catch {
      setAnalysis(null);
    } finally {
      setAnalyzeLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="heading-xl">AI intelligence</h1>
        <p className="text-[var(--b70-muted)] max-w-2xl">
          Alpha scores blend momentum, liquidity, sentiment proxies, and calm-volatility risk. CoinGecko
          market data only—exploratory, not financial advice.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-4 rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-4">
        <div className="space-y-1">
          <label className="small font-medium text-[var(--b70-muted)]" htmlFor={`${formId}-tf`}>
            Timeframe
          </label>
          <select
            id={`${formId}-tf`}
            className={clsx(
              "rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-[var(--b70-crypto-blue)]/40",
            )}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as AIIntelligenceTimeframe)}
          >
            <option value="24h">24h momentum</option>
            <option value="7d">7d momentum</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="small font-medium text-[var(--b70-muted)]" htmlFor={`${formId}-mcap`}>
            Min market cap (USD)
          </label>
          <input
            id={`${formId}-mcap`}
            type="text"
            inputMode="numeric"
            placeholder="e.g. 100000000"
            className={clsx(
              "w-44 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-[var(--b70-crypto-blue)]/40",
            )}
            value={minMcap}
            onChange={(e) => setMinMcap(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="small font-medium text-[var(--b70-muted)]" htmlFor={`${formId}-risk`}>
            Volatility band
          </label>
          <select
            id={`${formId}-risk`}
            className={clsx(
              "rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-[var(--b70-crypto-blue)]/40",
            )}
            value={risk}
            onChange={(e) => setRisk((e.target.value || "") as AIIntelligenceRisk | "")}
          >
            <option value="">Any</option>
            <option value="low">Low (calmer 24h)</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <button
          type="button"
          className="rounded-lg bg-[var(--b70-crypto-blue)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </section>

      <form onSubmit={onAnalyze} className="space-y-2 rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/40 p-4">
        <label className="small font-medium text-[var(--b70-muted)]" htmlFor={`${formId}-q`}>
          Quick analyze (optional)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${formId}-q`}
            className={clsx(
              "min-w-0 flex-1 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm",
            )}
            placeholder="Ask about trends or risks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={analyzeLoading}
            className="rounded-lg border border-[var(--b70-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--b70-border)]/30 disabled:opacity-50"
          >
            {analyzeLoading ? "…" : "Analyze"}
          </button>
        </div>
        {analysis ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-[var(--b70-fg)]">{analysis.summary}</p>
            {analysis.key_trends.length > 0 ? (
              <ul className="list-inside list-disc text-[var(--b70-muted)]">
                {analysis.key_trends.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            {analysis.risks.length > 0 ? (
              <ul className="list-inside list-disc text-amber-600/90 dark:text-amber-400/90">
                {analysis.risks.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>

      {loading ? (
        <p className="small text-[var(--b70-muted)]">Loading opportunities…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((o) => (
          <Card key={`${o.asset_symbol}-${o.coingecko_id ?? o.name ?? ""}`} className="overflow-hidden">
            <div className="flex gap-4 p-4">
              <ScoreRing score={o.score} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-lg font-semibold">{o.asset_symbol}</span>
                  {o.name ? (
                    <span className="truncate text-sm text-[var(--b70-muted)]">{o.name}</span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--b70-muted)]">
                  {o.market_cap != null ? <span>Mcap {formatCompactUsd(o.market_cap)}</span> : null}
                  {o.price_change_24h != null ? (
                    <span>24h {formatChangePct(o.price_change_24h)}</span>
                  ) : null}
                  {timeframe === "7d" && o.price_change_7d != null ? (
                    <span>7d {formatChangePct(o.price_change_7d)}</span>
                  ) : null}
                  {o.risk_tier ? <span className="capitalize">Vol: {o.risk_tier}</span> : null}
                </div>
              </div>
            </div>
            <div className="space-y-2 border-t border-[var(--b70-border)] px-4 py-3">
              {SIGNAL_ORDER.map((k) => (
                <SignalBar
                  key={k}
                  label={k}
                  value={o.signals[k] ?? 0}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>

      {!loading && !error && rows.length === 0 ? (
        <p className="text-sm text-[var(--b70-muted)]">No rows match the filters.</p>
      ) : null}
    </div>
  );
}
