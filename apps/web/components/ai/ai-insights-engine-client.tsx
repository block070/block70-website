"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import type { AIInsightDto, MarketNarrativeDto } from "@/lib/api";
import {
  INSIGHT_MODE_STORAGE_KEY,
  RECENT_INSIGHT_HOURS,
  dedupeInsights,
  isMacroBucketType,
  isRecentInsight,
  isRiskBucketType,
  modeHeroSubtitle,
  presentInsightTypeLabel,
  sortInsightsForMode,
  type InsightsViewerMode,
} from "@/lib/ai-insight-present";
import { InsightEngineCard } from "./insight-engine-card";

type BriefingLite = {
  id: number;
  summary: string;
  created_at: string;
} | null;

type Props = {
  initialInsights: AIInsightDto[];
  briefing: BriefingLite;
  narratives: MarketNarrativeDto[];
  loadWarnings: string[];
  generatedAt: string;
};

const MODES: { id: InsightsViewerMode; label: string }[] = [
  { id: "trader", label: "Trader" },
  { id: "investor", label: "Investor" },
  { id: "beginner", label: "Beginner" },
];

export function AiInsightsEngineClient({
  initialInsights,
  briefing,
  narratives,
  loadWarnings,
  generatedAt,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<InsightsViewerMode>("investor");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [minConfidencePct, setMinConfidencePct] = useState(0);

  useEffect(() => {
    const q = searchParams.get("mode");
    if (q === "trader" || q === "investor" || q === "beginner") {
      setMode(q);
      return;
    }
    try {
      const stored = localStorage.getItem(INSIGHT_MODE_STORAGE_KEY);
      if (stored === "trader" || stored === "investor" || stored === "beginner") {
        setMode(stored);
      }
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  const setModeAndUrl = useCallback(
    (m: InsightsViewerMode) => {
      setMode(m);
      try {
        localStorage.setItem(INSIGHT_MODE_STORAGE_KEY, m);
      } catch {
        /* ignore */
      }
      const p = new URLSearchParams(searchParams.toString());
      p.set("mode", m);
      router.replace(`/insights?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const filteredSorted = useMemo(() => {
    let rows = dedupeInsights(initialInsights);
    if (typeFilter) {
      rows = rows.filter((i) => i.insight_type === typeFilter);
    }
    if (minConfidencePct > 0) {
      rows = rows.filter((i) => (i.confidence_score ?? 0) * 100 >= minConfidencePct);
    }
    return sortInsightsForMode(rows, mode);
  }, [initialInsights, typeFilter, minConfidencePct, mode]);

  const recentInsights = useMemo(
    () => filteredSorted.filter((i) => isRecentInsight(i.created_at)),
    [filteredSorted],
  );

  const olderInsights = useMemo(
    () => filteredSorted.filter((i) => !isRecentInsight(i.created_at)),
    [filteredSorted],
  );

  const riskDaily = useMemo(
    () => filteredSorted.filter((i) => isRiskBucketType(i.insight_type)).slice(0, 8),
    [filteredSorted],
  );

  const macroDaily = useMemo(
    () => filteredSorted.filter((i) => isMacroBucketType(i.insight_type)).slice(0, 8),
    [filteredSorted],
  );

  const insightTypes = useMemo(() => {
    const s = new Set(initialInsights.map((i) => i.insight_type));
    return Array.from(s).sort();
  }, [initialInsights]);

  const narrativeSlice = narratives.slice(0, 8);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 md:p-6">
        <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-[var(--b70-crypto-blue)]/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--b70-crypto-blue)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI market analysis
            </span>
            <span className="text-[10px] text-[var(--b70-text-muted)]">
              Presentation only · {modeHeroSubtitle(mode)}
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-jetbrains)] text-2xl font-bold tracking-tight text-[var(--b70-text)] md:text-3xl">
            Real-time insight engine
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--b70-text-muted)]">
            Daily pulse from briefings and narratives plus hourly deltas from the AI insight feed.
            Reasoning cites stored lineage where available—not a live brokerage research desk.
          </p>
          <p className="text-[10px] text-[var(--b70-text-muted)]">
            Snapshot: {new Date(generatedAt).toLocaleString()}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
              Mode
            </span>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModeAndUrl(m.id)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === m.id
                    ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/15 text-[var(--b70-crypto-blue)]"
                    : "border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)] hover:border-[var(--b70-crypto-blue)]/40",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loadWarnings.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100">
          {loadWarnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Daily pulse</h2>
        </div>
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          Market summary, narrative monitor, and insight columns by theme (risk vs macro/flow).
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-crypto-blue)]">
              Briefing summary
            </h3>
            {briefing ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-[var(--b70-text-muted)]">
                  {mode === "beginner"
                    ? briefing.summary.slice(0, 400) +
                      (briefing.summary.length > 400 ? "…" : "")
                    : briefing.summary}
                </p>
                <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">
                  {new Date(briefing.created_at).toLocaleString()}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--b70-text-muted)]">
                No briefing in view—run the briefing pipeline or check API.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-crypto-blue)]">
              Key narratives
            </h3>
            {narrativeSlice.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--b70-text-muted)]">No narratives loaded.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {narrativeSlice.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-[var(--b70-text)]">{n.name}</p>
                    {n.description ? (
                      <p className="mt-1 line-clamp-2 text-[var(--b70-text-muted)]">
                        {n.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
                      Trend score {(n.trend_score * 100).toFixed(0)}%
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--b70-text)]">
              <Activity className="h-4 w-4 text-amber-500/90" aria-hidden />
              <h3 className="text-xs font-semibold uppercase tracking-wide">Risk watch</h3>
            </div>
            <p className="text-[10px] text-[var(--b70-text-muted)]">
              Narrative shifts and opportunity-shaped alerts—monitor, don&apos;t chase blindly.
            </p>
            {riskDaily.length === 0 ? (
              <p className="text-sm text-[var(--b70-text-muted)]">No rows in this bucket.</p>
            ) : (
              <ul className="space-y-3">
                {riskDaily.map((i) => (
                  <li key={i.id}>
                    <InsightEngineCard insight={i} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[var(--b70-text)]">
              <Activity className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
              <h3 className="text-xs font-semibold uppercase tracking-wide">Macro &amp; flow</h3>
            </div>
            <p className="text-[10px] text-[var(--b70-text-muted)]">
              Broad market trends and wallet-linked activity themes.
            </p>
            {macroDaily.length === 0 ? (
              <p className="text-sm text-[var(--b70-text-muted)]">No rows in this bucket.</p>
            ) : (
              <ul className="space-y-3">
                {macroDaily.map((i) => (
                  <li key={i.id}>
                    <InsightEngineCard insight={i} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--b70-text)]">
              Hourly stream · last {RECENT_INSIGHT_HOURS}h
            </h2>
          </div>
          <Link
            href="/insights/history"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--b70-crypto-blue)] hover:underline"
          >
            Full history
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] uppercase text-[var(--b70-text-muted)]">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-1 block h-9 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-xs text-[var(--b70-text)]"
              >
                <option value="">All</option>
                {insightTypes.map((t) => (
                  <option key={t} value={t}>
                    {presentInsightTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-[var(--b70-text-muted)]">
                Min confidence
              </label>
              <select
                value={minConfidencePct}
                onChange={(e) => setMinConfidencePct(Number(e.target.value))}
                className="mt-1 block h-9 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-xs text-[var(--b70-text)]"
              >
                <option value={0}>Any</option>
                <option value={40}>40%+</option>
                <option value={60}>60%+</option>
                <option value={80}>80%+</option>
              </select>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[var(--b70-text)]">What&apos;s new</h3>
          {recentInsights.length === 0 ? (
            <p className="text-sm text-[var(--b70-text-muted)]">
              Nothing in the recent window with current filters.
            </p>
          ) : (
            <ul className="space-y-4">
              {recentInsights.map((i) => (
                <li key={i.id}>
                  <InsightEngineCard insight={i} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {olderInsights.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--b70-text-muted)]">Earlier</h3>
            <ul className="space-y-4">
              {olderInsights.map((i) => (
                <li key={`older-${i.id}`}>
                  <InsightEngineCard insight={i} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
