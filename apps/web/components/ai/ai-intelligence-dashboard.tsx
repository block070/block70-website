"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CoinIntelligenceTerminal } from "@/components/ai/coin-intelligence-terminal";
import {
  getAIIntelligenceOpportunities,
  postAIIntelligenceAnalyze,
  type AIIntelligenceOpportunitiesResponse,
  type AIIntelligenceOpportunity,
  type QueryIntentDebug,
  type AIIntelligenceRisk,
  type AIIntelligenceTimeframe,
} from "@/lib/ai-intelligence-api";
import { formatChangePct, formatCompactUsd } from "@/lib/format";
import {
  getIntelSearchModeHintLabel,
  inferIntelSearchModeHint,
  INTEL_SEARCH_PLACEHOLDER_EXAMPLES,
  isCoinTerminalLoadingHint,
} from "@/lib/intelligence-search-hints";

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
        <span className="text-sm font-semibold tabular-nums text-[var(--b70-fg)]">{Math.round(pct)}</span>
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

function rankArrow(d: number | null | undefined): { ch: string; cls: string } {
  if (d == null || d === 0) return { ch: "→", cls: "text-[var(--b70-muted)]" };
  if (d > 0) return { ch: `↑ ${d}`, cls: "text-emerald-600 dark:text-emerald-400" };
  return { ch: `↓ ${Math.abs(d)}`, cls: "text-rose-600 dark:text-rose-400" };
}

function freshnessLabel(fr: string | null | undefined): string {
  if (!fr) return "—";
  if (fr === "EXHAUSTED") return "Fading";
  if (fr === "NEW") return "New";
  if (fr === "BUILDING") return "Building";
  if (fr === "AGING") return "Aging";
  return fr;
}

function stageBadge(stage: string | null | undefined): string {
  const s = (stage || "—").toUpperCase();
  if (s === "EARLY") return "EARLY";
  if (s === "MID") return "MID";
  if (s === "LATE") return "LATE";
  return s;
}

function whyThisMatters(qi: QueryIntentDebug | undefined): string {
  const intent = qi?.intent ?? "DISCOVERY";
  const fn = qi?.filter_narratives?.length ? qi.filter_narratives.join(", ") : null;
  const fs = qi?.focus_symbols?.length ? qi.focus_symbols.join(", ") : null;
  const sort = qi?.sort_mode ?? "default";
  const parts: string[] = [];
  if (intent === "PREDICTION") {
    parts.push("Your query reads as prediction-seeking; ordering weights velocity and early-cycle tape.");
  } else if (intent === "RISK") {
    parts.push("Defensive intent: rankings favor confidence and calmer volatility tiers.");
  } else if (intent === "SECTOR") {
    parts.push(`Sector lens applied${fn ? ` (${fn})` : ""}; only narrative-tagged names are prioritized ahead of backfill.`);
  } else if (intent === "SPECIFIC_ASSET" || intent === "ANALYSIS") {
    parts.push(`Single-asset focus${fs ? ` on ${fs}` : ""} with peer narratives used for context.`);
  } else {
    parts.push("Discovery mode: broad opportunity scan under current regime and rotation telemetry.");
  }
  parts.push(`Engine sort: ${sort}.`);
  return parts.join(" ");
}

function marketHeroLine(data: AIIntelligenceOpportunitiesResponse): string {
  const shifts = data.recent_shifts?.[0];
  const pred = data.predictions?.[0];
  const rot = data.capital_rotation?.[0];
  if (shifts) return shifts;
  if (pred) return pred;
  if (rot) return `${rot.narrative_id} rotation phase ${rot.phase} — regime ${data.market_regime}.`;
  return `Market regime ${data.market_regime} — scanning ranked opportunities.`;
}

function OpportunityIntelCard({
  o,
  timeframe,
  featured,
  index,
}: {
  o: AIIntelligenceOpportunity;
  timeframe: AIIntelligenceTimeframe;
  featured: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const ra = rankArrow(o.rank_delta);
  const bullets = (o.rank_reasons ?? o.confluence_flags ?? []).slice(0, 3).filter(Boolean) as string[];
  const accent =
    o.probability_of_move != null &&
    o.probability_of_move >= 58 &&
    (o.cycle_stage === "EARLY" || (o.rank_delta ?? 0) > 0)
      ? "border-l-4 border-l-emerald-500/70"
      : o.signal_freshness === "EXHAUSTED" || (o.rank_delta ?? 0) < -2
        ? "border-l-4 border-l-rose-500/50"
        : "border-l-4 border-l-amber-500/40";

  const probBig = featured ? "text-3xl" : "text-2xl";

  return (
    <div
      className="b70-intel-card-respects-motion"
      style={
        {
          animationDelay: `${Math.min(index, 12) * 45}ms`,
        } as React.CSSProperties
      }
    >
    <Card
      className={clsx(
        "overflow-hidden transition-all duration-300",
        featured ? "md:col-span-2 ring-1 ring-[var(--b70-crypto-blue)]/15" : "",
        accent,
      )}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer gap-4 p-4 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ScoreRing score={o.score} size={featured ? 64 : 56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={clsx("font-semibold text-[var(--b70-fg)]", featured ? "text-xl" : "text-lg")}>
              {o.asset_symbol}
            </span>
            {o.name ? <span className="truncate text-sm text-[var(--b70-muted)]">{o.name}</span> : null}
            <span className="rounded border border-[var(--b70-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--b70-muted)]">
              {stageBadge(o.cycle_stage)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            {o.probability_of_move != null ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--b70-muted)]">Probability</p>
                <p className={clsx("font-[family-name:var(--font-jetbrains)] font-bold tabular-nums text-[var(--b70-fg)]", probBig)}>
                  {Math.round(o.probability_of_move)}
                  <span className="text-sm font-medium text-[var(--b70-muted)]">%</span>
                </p>
              </div>
            ) : null}
            <span className={clsx("text-sm font-medium tabular-nums", ra.cls)}>{ra.ch} rank</span>
            <span className="text-[11px] text-[var(--b70-muted)]">{freshnessLabel(o.signal_freshness)}</span>
          </div>
          <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-[var(--b70-muted)]">
            {bullets.map((b) => (
              <li key={b.slice(0, 48)}>{b.length > 120 ? `${b.slice(0, 117)}…` : b}</li>
            ))}
          </ul>
        </div>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-[var(--b70-border)] px-4 py-3">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--b70-muted)]">
            {o.market_cap != null ? <span>Mcap {formatCompactUsd(o.market_cap)}</span> : null}
            {o.current_price != null ? <span>Price ${o.current_price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span> : null}
            {o.price_change_24h != null ? <span>24h {formatChangePct(o.price_change_24h)}</span> : null}
            {timeframe === "7d" && o.price_change_7d != null ? <span>7d {formatChangePct(o.price_change_7d)}</span> : null}
            {o.risk_tier ? <span className="capitalize">Vol {o.risk_tier}</span> : null}
            {o.confidence_score != null ? <span>Conf {Math.round(o.confidence_score)}</span> : null}
            {o.entry_signal && o.entry_signal !== "none" ? <span>Entry {o.entry_signal}</span> : null}
            {o.narrative_tags && o.narrative_tags.length > 0 ? (
              <span>Tags {o.narrative_tags.join(", ")}</span>
            ) : null}
          </div>
          <div className="space-y-2">
            {SIGNAL_ORDER.map((k) => (
              <SignalBar key={k} label={k} value={o.signals[k] ?? 0} />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
    </div>
  );
}

export function AIIntelligenceDashboard() {
  const formId = useId();
  const [timeframe, setTimeframe] = useState<AIIntelligenceTimeframe>("24h");
  const [minMcap, setMinMcap] = useState<string>("");
  const [risk, setRisk] = useState<AIIntelligenceRisk | "">("");
  const [limit] = useState(12);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [payload, setPayload] = useState<AIIntelligenceOpportunitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    summary: string;
    key_trends: string[];
    risks: string[];
    formatted_report?: string;
    market_regime?: string;
    predictions?: string[];
    query_intent?: QueryIntentDebug;
    output_mode?: string;
  } | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [placeholderExampleIndex, setPlaceholderExampleIndex] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchIdRef = useRef(0);

  const minMcapNum = useMemo(() => {
    const n = parseFloat(minMcap.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [minMcap]);

  const load = useCallback(async () => {
    const reqId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const data = await getAIIntelligenceOpportunities({
        limit,
        timeframe,
        minMcap: minMcapNum,
        risk: risk || undefined,
        query: activeQuery.trim() || undefined,
      });
      if (reqId !== fetchIdRef.current) return;
      setPayload(data);
    } catch (e) {
      if (reqId !== fetchIdRef.current) return;
      setError(e instanceof Error ? e.message : "Failed to load");
      setPayload(null);
    } finally {
      if (reqId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [limit, timeframe, minMcapNum, risk, activeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderExampleIndex((i) => (i + 1) % INTEL_SEARCH_PLACEHOLDER_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const flushActiveQuery = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    const t = searchQuery.trim();
    setActiveQuery((prev) => (prev === t ? prev : t));
  }, [searchQuery]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      const t = searchQuery.trim();
      setActiveQuery((prev) => (prev === t ? prev : t));
    }, 550);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [searchQuery]);

  const draftModeHint = useMemo(() => inferIntelSearchModeHint(searchQuery), [searchQuery]);

  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    flushActiveQuery();
  }

  async function onAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const q = reportQuery.trim() || searchQuery.trim();
    if (!q) return;
    setAnalyzeLoading(true);
    try {
      const res = await postAIIntelligenceAnalyze(q);
      setAnalysis({
        summary: res.summary,
        key_trends: res.key_trends ?? [],
        risks: res.risks ?? [],
        formatted_report: res.formatted_report,
        market_regime: res.market_regime,
        predictions: res.predictions,
        query_intent: res.query_intent,
        output_mode: res.output_mode,
      });
    } catch {
      setAnalysis(null);
    } finally {
      setAnalyzeLoading(false);
    }
  }

  const intent = payload?.query_intent?.intent ?? "DISCOVERY";
  const isCoinIntent = intent === "SPECIFIC_ASSET" || intent === "ANALYSIS";
  const coinMode = Boolean(payload && isCoinIntent);
  const coinIntelReady = Boolean(payload?.coin_intel);
  const focusSymbol =
    payload?.query_intent?.focus_symbols && payload.query_intent.focus_symbols.length > 0
      ? payload.query_intent.focus_symbols[0]
      : null;

  const predictionsFirst = intent === "PREDICTION";

  const marketBundle = !loading && payload && !coinMode ? payload : null;
  const showCoinLoadingSkeleton = Boolean(
    loading && activeQuery.trim() && isCoinTerminalLoadingHint(activeQuery),
  );
  const showMarketLoadingSkeleton = Boolean(loading && !showCoinLoadingSkeleton);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="heading-xl">Intelligence desk</h1>
        <p className="max-w-2xl text-sm text-[var(--b70-muted)]">
          Decision-first crypto intelligence: regime, rotation, ranked opportunities, and coin-level briefing when you
          name a ticker.
        </p>
      </header>

      <form onSubmit={onSearchSubmit} className="space-y-2 rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-4">
        <label className="small font-medium text-[var(--b70-muted)]" htmlFor={`${formId}-q`}>
          Search crypto intelligence
        </label>
        <div className="space-y-1.5">
          <input
            id={`${formId}-q`}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-describedby={`${formId}-search-help ${formId}-mode-hint`}
            className={clsx(
              "min-w-0 w-full rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-[var(--b70-crypto-blue)]/40",
            )}
            placeholder={`Try: ${INTEL_SEARCH_PLACEHOLDER_EXAMPLES[placeholderExampleIndex]}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="sr-only">
            Search
          </button>
          <p id={`${formId}-search-help`} className="text-[11px] text-[var(--b70-muted)]">
            Press <kbd className="rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-1 font-mono text-[10px]">Enter</kbd>{" "}
            to search, or pause typing — results update automatically after a short delay.
          </p>
          {draftModeHint ? (
            <p id={`${formId}-mode-hint`} className="text-xs font-medium text-[var(--b70-crypto-blue)]">
              Detected mode: {getIntelSearchModeHintLabel(draftModeHint)}
            </p>
          ) : (
            <span id={`${formId}-mode-hint`} className="sr-only">
              Start typing to see how your query will be interpreted.
            </span>
          )}
        </div>
        {loading && activeQuery.trim() ? (
          <p className="text-xs text-[var(--b70-muted)]">
            Searching: <span className="font-medium text-[var(--b70-fg)]">{activeQuery.trim()}</span>
          </p>
        ) : null}
        {payload?.coin_fallback && coinMode && !payload?.coin_intel ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Coin intelligence batch: {focusSymbol ?? "asset"} was not in the ranked set — showing a neutral market
            slice. Intent stays single-asset.
          </p>
        ) : null}
        {activeQuery.trim() &&
        !loading &&
        payload &&
        intent === "DISCOVERY" &&
        !coinMode &&
        !payload?.coin_fallback ? (
          <p className="text-xs text-[var(--b70-muted)]">Discovery ranking applied to your keywords.</p>
        ) : null}
      </form>

      {marketBundle ? (
        <div className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/90 p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
            Market call
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-snug text-[var(--b70-fg)] md:text-xl">
            {marketHeroLine(marketBundle)}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[var(--b70-border)] px-2.5 py-0.5 font-medium">
              Regime {marketBundle.market_regime}
            </span>
            {marketBundle.capital_rotation[0] ? (
              <span className="rounded-full border border-[var(--b70-border)] px-2.5 py-0.5 text-[var(--b70-muted)]">
                {marketBundle.capital_rotation[0].narrative_id} ·{" "}
                {marketBundle.capital_rotation[0].phase.replace(/_/g, " ")}
              </span>
            ) : null}
            {marketBundle.predictions?.[0] ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                {marketBundle.predictions[0]}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {marketBundle ? (
        <aside className="rounded-b70-lg border border-dashed border-[var(--b70-border)] bg-[var(--b70-bg)]/40 px-4 py-3 text-sm text-[var(--b70-muted)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-crypto-blue)]">
            Why this layout
          </p>
          <p className="mt-1">{whyThisMatters(marketBundle.query_intent)}</p>
        </aside>
      ) : null}

      {marketBundle && marketBundle.capital_rotation.length > 0 ? (
        <div className="flex flex-wrap gap-3 rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-4 py-3 text-sm">
          <span className="font-medium text-[var(--b70-fg)]">
            Meta: <span className="text-[var(--b70-muted)]">{marketBundle.market_regime}</span>
          </span>
          </div>
      ) : null}

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
          disabled={loading}
          className="rounded-lg bg-[var(--b70-crypto-blue)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </section>

      {coinIntelReady && payload?.coin_intel ? <CoinIntelligenceTerminal data={payload.coin_intel} /> : null}

      {coinMode && payload && !payload.coin_intel ? (
        <div className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/80 p-6 text-center text-sm text-[var(--b70-muted)]">
          <p className="font-medium text-[var(--b70-fg)]">
            {focusSymbol ? `${focusSymbol} intelligence` : "Coin intelligence"}
          </p>
          <p className="mt-2">
            Full briefing is unavailable until this symbol appears in the live ranked universe. Try refresh or widen
            filters.
          </p>
        </div>
      ) : null}

      {showMarketLoadingSkeleton ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-b70-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-b70-lg" />
            ))}
          </div>
        </div>
      ) : null}

      {showCoinLoadingSkeleton ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-b70-lg" />
          <Skeleton className="h-64 w-full rounded-b70-lg" />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {marketBundle ? (
        <div className="space-y-4">
          {predictionsFirst && marketBundle.predictions && marketBundle.predictions.length > 0 ? (
            <details open className="group rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/80">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--b70-fg)]">
                Predictions
              </summary>
              <ul className="list-inside list-disc space-y-1 px-4 pb-4 text-sm text-[var(--b70-muted)]">
                {marketBundle.predictions.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <details open className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/80">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--b70-fg)]">
              Top opportunities
            </summary>
            <div className="grid gap-4 px-4 pb-4 md:grid-cols-2">
              {marketBundle.opportunities.map((o, index) => (
                <OpportunityIntelCard
                  key={`${o.asset_symbol}-${o.coingecko_id ?? index}`}
                  o={o}
                  timeframe={timeframe}
                  featured={index < 3}
                  index={index}
                />
              ))}
            </div>
          </details>

          {!predictionsFirst && marketBundle.predictions && marketBundle.predictions.length > 0 ? (
            <details open className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/80">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--b70-fg)]">
                Predictions
              </summary>
              <ul className="list-inside list-disc space-y-1 px-4 pb-4 text-sm text-[var(--b70-muted)]">
                {marketBundle.predictions.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <details className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--b70-fg)]">
              Capital rotation
            </summary>
            <ul className="space-y-1 px-4 pb-4 text-sm text-[var(--b70-muted)]">
              {marketBundle.capital_rotation.map((r) => (
                <li key={r.narrative_id}>
                  {r.narrative_id}: {r.phase.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          </details>

          {marketBundle.portfolio_positioning && Object.keys(marketBundle.portfolio_positioning).length > 0 ? (
            <details className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--b70-fg)]">
                Portfolio positioning
              </summary>
              <div className="space-y-2 px-4 pb-4 text-xs text-[var(--b70-muted)]">
                {Object.entries(marketBundle.portfolio_positioning).map(([k, v]) => (
                  <div key={k}>
                    <span className="font-medium text-[var(--b70-fg)]">{k}</span>: {v.join(", ")}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <details className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--b70-fg)]">
              Emerging signals
            </summary>
            <div className="space-y-2 px-4 pb-4 text-xs text-[var(--b70-muted)]">
              {(marketBundle.emerging_signals && marketBundle.emerging_signals.length > 0
                ? marketBundle.emerging_signals
                : [...(marketBundle.recent_shifts ?? []), ...marketBundle.model_insights]
              ).map((s) => (
                <p key={s}>{s}</p>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      <form
        onSubmit={onAnalyze}
        className="space-y-2 rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/40 p-4"
      >
        <label className="small font-medium text-[var(--b70-muted)]" htmlFor={`${formId}-deep`}>
          Deep report (optional LLM narrative)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${formId}-deep`}
            className={clsx(
              "min-w-0 flex-1 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm",
            )}
            placeholder="Optional — defaults to command query"
            value={reportQuery}
            onChange={(e) => setReportQuery(e.target.value)}
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
            {analysis.query_intent?.intent ? (
              <p className="text-xs font-medium text-[var(--b70-crypto-blue)]">
                Intent {analysis.query_intent.intent}
                {analysis.output_mode ? ` · ${analysis.output_mode}` : ""}
              </p>
            ) : null}
            <p className="text-[var(--b70-fg)]">{analysis.summary}</p>
            {analysis.predictions && analysis.predictions.length > 0 ? (
              <ul className="list-inside list-disc text-[var(--b70-fg)]">
                {analysis.predictions.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            {analysis.formatted_report ? (
              <details>
                <summary className="cursor-pointer text-xs text-[var(--b70-muted)]">Full report</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)]/80 p-3 text-xs text-[var(--b70-muted)]">
                  {analysis.formatted_report}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </form>

      <p className="text-center text-[10px] text-[var(--b70-muted)]">
        Intelligence outputs are model interpretation — not financial advice.
      </p>

      {!error && marketBundle && marketBundle.opportunities.length === 0 ? (
        <p className="text-sm text-[var(--b70-muted)]">No rows match the filters.</p>
      ) : null}
    </div>
  );
}
