"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CoinSymbol } from "@/components/market/coin-symbol";
import { SparklineSvg } from "@/components/market/sparkline-svg";
import { TrendingAttentionBubbles } from "@/components/trending/trending-attention-bubbles";
import { useExchangeAffiliateTemplates } from "@/contexts/exchange-affiliate-context";
import type { CategoryDirectoryApiItem, MarketNarrativeDto } from "@/lib/api";
import { getExchangeBuyUrls } from "@/lib/exchange-buy-urls";
import { formatChangePct, formatPrice } from "@/lib/format";
import type { EnrichedTrendingRow } from "@/lib/trending-metrics";
import {
  momentumPhaseClasses,
  momentumPhaseLabel,
  smartMoneyDisplay,
  TRENDING_TABS,
  tierScoreClasses,
  type TrendTab,
} from "@/lib/trending-metrics";
import {
  filterRowsByTab,
  type TrendingHoursWindow,
  type TrendingOpportunity,
} from "@/lib/trending-page-data";
import { clsx } from "clsx";
import { LayoutGrid, Sparkles, Tag } from "lucide-react";

const POLL_MS = 60_000;
const RANK_TRACK = 40;
const STORAGE_PREFIX = "block70_trending_slugs_v1_";

type MainTab = "coins" | "narratives" | "categories";

type PollPayload = {
  rows?: EnrichedTrendingRow[];
  opportunities?: TrendingOpportunity[];
  updatedAt?: string;
  narratives?: MarketNarrativeDto[];
  categories?: CategoryDirectoryApiItem[];
  hours?: TrendingHoursWindow;
};

function rankStorageKey(hours: TrendingHoursWindow): string {
  return `${STORAGE_PREFIX}${hours}`;
}

function readPrevSlugs(hours: TrendingHoursWindow): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(rankStorageKey(hours));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

function writeSlugs(hours: TrendingHoursWindow, slugs: string[]) {
  try {
    sessionStorage.setItem(rankStorageKey(hours), JSON.stringify(slugs));
  } catch {
    /* ignore */
  }
}

function computeRankMaps(prev: string[] | null, slugs: string[]) {
  const deltaBySlug = new Map<string, number>();
  const isNewBySlug = new Map<string, boolean>();
  if (!prev?.length) {
    return { deltaBySlug, isNewBySlug, hasPrev: false };
  }
  const prevTop = new Set(prev.slice(0, RANK_TRACK));
  for (let i = 0; i < prev.length; i++) {
    const slug = prev[i];
    const j = slugs.indexOf(slug);
    if (j >= 0) deltaBySlug.set(slug, i - j);
  }
  for (let k = 0; k < slugs.length && k < RANK_TRACK; k++) {
    const slug = slugs[k];
    isNewBySlug.set(slug, !prevTop.has(slug));
  }
  return { deltaBySlug, isNewBySlug, hasPrev: true };
}

function useTrendingPoll(
  initialRows: EnrichedTrendingRow[],
  initialOpportunities: TrendingOpportunity[],
  initialUpdatedAt: string,
  initialNarratives: MarketNarrativeDto[],
  initialCategories: CategoryDirectoryApiItem[],
  hours: TrendingHoursWindow,
  intervalMs: number,
) {
  const [rows, setRows] = useState(initialRows);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [narratives, setNarratives] = useState(initialNarrativeDto(initialNarratives));
  const [categories, setCategories] = useState(initialCategories);
  const [flashSlugs, setFlashSlugs] = useState<Set<string>>(new Set());
  const [rankDeltaBySlug, setRankDeltaBySlug] = useState<Map<string, number>>(() => new Map());
  const [isNewBySlug, setIsNewBySlug] = useState<Map<string, boolean>>(() => new Map());
  const [hasRankPrev, setHasRankPrev] = useState(false);

  useEffect(() => {
    setRows(initialRows);
    setOpportunities(initialOpportunities);
    setUpdatedAt(initialUpdatedAt);
    setNarratives(initialNarratives);
    setCategories(initialCategories);
    const slugs0 = initialRows.map((r) => r.coin.slug);
    const prev0 = readPrevSlugs(hours);
    const m0 = computeRankMaps(prev0, slugs0);
    setRankDeltaBySlug(m0.deltaBySlug);
    setIsNewBySlug(m0.isNewBySlug);
    setHasRankPrev(m0.hasPrev);
    writeSlugs(hours, slugs0);
  }, [initialRows, initialOpportunities, initialUpdatedAt, initialNarratives, initialCategories, hours]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/trending?hours=${hours}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as PollPayload;
        if (!data.rows?.length) return;

        const prev = readPrevSlugs(hours);
        const slugs = data.rows.map((r) => r.coin.slug);
        const m = computeRankMaps(prev, slugs);
        setRankDeltaBySlug(m.deltaBySlug);
        setIsNewBySlug(m.isNewBySlug);
        setHasRankPrev(m.hasPrev);
        writeSlugs(hours, slugs);

        setRows((prevRows) => {
          const flash = new Set<string>();
          for (const r of data.rows!) {
            const old = prevRows.find((p) => p.coin.slug === r.coin.slug);
            if (
              old &&
              (old.attentionScore !== r.attentionScore ||
                old.coin.priceUsd !== r.coin.priceUsd ||
                old.coin.change24hPct !== r.coin.change24hPct)
            ) {
              flash.add(r.coin.slug);
            }
          }
          if (flash.size > 0) {
            setFlashSlugs(flash);
            window.setTimeout(() => {
              if (!cancelled) setFlashSlugs(new Set());
            }, 1400);
          }
          return data.rows!;
        });
        if (data.opportunities) setOpportunities(data.opportunities);
        if (data.updatedAt) setUpdatedAt(data.updatedAt);
        if (data.narratives?.length) setNarratives(data.narratives);
        if (data.categories?.length) setCategories(data.categories);
      } catch {
        /* ignore */
      }
    };

    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs, hours]);

  return {
    rows,
    opportunities,
    updatedAt,
    narratives,
    categories,
    flashSlugs,
    rankDeltaBySlug,
    isNewBySlug,
    hasRankPrev,
  };
}

function initialNarrativeDto(n: MarketNarrativeDto[]): MarketNarrativeDto[] {
  return Array.isArray(n) ? n : [];
}

const OpportunityCard = memo(function OpportunityCard({
  o,
}: {
  o: TrendingOpportunity;
}) {
  const ch = o.change24hPct;
  const pos = typeof ch === "number" && Number.isFinite(ch) && ch >= 0;
  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-lg border border-orange-500/35 bg-gradient-to-br from-orange-950/50 to-slate-950/80 p-3">
      <div className="flex items-center gap-2">
        <CoinSymbol
          symbol={o.symbol}
          logoUrl={o.logoUrl}
          name={o.name}
          size="sm"
          iconOnly
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{o.name}</p>
          <p className="text-[10px] text-slate-500">
            Attention {o.attentionScore} · B70 {o.block70Score}
          </p>
        </div>
      </div>
      <p
        className={clsx(
          "text-xs font-medium tabular-nums",
          pos ? "text-emerald-400" : "text-red-400",
        )}
      >
        {formatChangePct(ch)}
        <span className="text-slate-500"> 24h</span>
      </p>
      <Link
        href={`/coins/${encodeURIComponent(o.slug)}`}
        className="inline-flex w-full items-center justify-center rounded-md bg-orange-500/90 py-1.5 text-center text-[11px] font-semibold text-slate-950 transition hover:bg-orange-400"
      >
        View Analysis
      </Link>
    </div>
  );
});

const MAIN_TABS: { id: MainTab; label: string }[] = [
  { id: "coins", label: "Coins" },
  { id: "narratives", label: "Narratives" },
  { id: "categories", label: "Categories" },
];

export function TrendingPageClient({
  initialRows,
  initialOpportunities,
  initialUpdatedAt,
  initialNarratives,
  initialCategories,
  initialHours,
  isFallback,
}: {
  initialRows: EnrichedTrendingRow[];
  initialOpportunities: TrendingOpportunity[];
  initialUpdatedAt: string;
  initialNarratives: MarketNarrativeDto[];
  initialCategories: CategoryDirectoryApiItem[];
  initialHours: TrendingHoursWindow;
  isFallback: boolean;
}) {
  const router = useRouter();
  const affiliateTemplates = useExchangeAffiliateTemplates();
  const [mainTab, setMainTab] = useState<MainTab>("coins");
  const [sectorTab, setSectorTab] = useState<TrendTab>("all");
  const hours = initialHours;
  const {
    rows,
    opportunities,
    updatedAt,
    narratives,
    categories,
    flashSlugs,
    rankDeltaBySlug,
    isNewBySlug,
    hasRankPrev,
  } = useTrendingPoll(
    initialRows,
    initialOpportunities,
    initialUpdatedAt,
    initialNarratives,
    initialCategories,
    hours,
    POLL_MS,
  );

  const filteredCoins = useMemo(
    () => filterRowsByTab(rows, sectorTab),
    [rows, sectorTab],
  );

  const onRowNav = useCallback(
    (slug: string) => {
      router.push(`/coins/${encodeURIComponent(slug)}`);
    },
    [router],
  );

  const setHoursAndUrl = useCallback(
    (h: TrendingHoursWindow) => {
      router.replace(`/trending?hours=${h}`);
    },
    [router],
  );

  return (
    <div className="space-y-5">
      {isFallback && (
        <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 p-3 text-xs text-amber-200">
          Showing sample data — API temporarily unavailable.{" "}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => router.refresh()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/50 p-4 shadow-b70-card">
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          <span className="font-medium text-[var(--b70-text)]">Methodology:</span> Attention Score
          blends tape and momentum with signal activity in your selected window. Search and social
          volume are not yet wired—when they are, they fold into this score. Not financial advice.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Window
        </span>
        {([1, 6, 24] as const).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHoursAndUrl(h)}
            className={clsx(
              "rounded-full px-3 py-1 text-[11px] font-medium transition",
              hours === h
                ? "bg-crypto-blue text-white"
                : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200",
            )}
          >
            {h}h
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-2">
        {MAIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMainTab(t.id)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              mainTab === t.id
                ? "bg-crypto-blue/20 text-crypto-blue"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
            )}
          >
            {t.id === "coins" ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : null}
            {t.id === "narratives" ? <Tag className="h-3.5 w-3.5" aria-hidden /> : null}
            {t.id === "categories" ? <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> : null}
            {t.label}
          </button>
        ))}
        <p className="ml-auto text-[10px] text-slate-500 tabular-nums">
          Updated {new Date(updatedAt).toLocaleTimeString()} · refresh {POLL_MS / 1000}s
        </p>
      </div>

      {mainTab === "coins" && (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Best exchange to buy trending coins
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Compare fees and liquidity on major venues — trade where execution fits your size.
            </p>
            <Link
              href="/exchanges"
              className="mt-2 inline-block text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Browse exchanges →
            </Link>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-slate-100">
              Top attention right now
            </h2>
            <p className="text-xs text-slate-500">
              Highest blend of Attention Score and Block70 score — not financial advice.
            </p>
            <div className="flex flex-wrap gap-3">
              {opportunities.map((o) => (
                <OpportunityCard key={o.slug} o={o} />
              ))}
            </div>
          </section>

          <TrendingAttentionBubbles rows={rows} />

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
            <div className="flex flex-wrap gap-1">
              {TRENDING_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSectorTab(t.id)}
                  className={clsx(
                    "rounded-full px-3 py-1 text-[11px] font-medium transition",
                    sectorTab === t.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="min-w-[1200px] w-full border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-slate-900/95 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Rank</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Δ rank</th>
                  <th className="min-w-[140px] px-2 py-2 font-medium">Coin</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Price</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">24h %</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Vol spike %</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Attention</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Phase</th>
                  <th className="min-w-[100px] px-2 py-2 font-medium">Narrative</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Signal</th>
                  <th
                    className="whitespace-nowrap px-2 py-2 font-medium"
                    title="Heuristic from momentum + turnover vs market cap"
                  >
                    Smart $
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 text-center font-medium">Mom.</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Spark 7d</th>
                  <th className="w-10 px-1 py-2" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/90">
                {filteredCoins.map((row, idx) => {
                  const c = row.coin;
                  const sm = smartMoneyDisplay(row.smartMoney);
                  const sparkPos =
                    typeof c.change7dPct === "number" && Number.isFinite(c.change7dPct)
                      ? c.change7dPct >= 0
                      : true;
                  const flash = flashSlugs.has(c.slug);
                  const buyUrls = getExchangeBuyUrls(c.symbol, c.slug, affiliateTemplates);
                  const delta = rankDeltaBySlug.get(c.slug);
                  const isNew = hasRankPrev && (isNewBySlug.get(c.slug) ?? false);
                  const deltaLabel =
                    !hasRankPrev || delta === undefined
                      ? "—"
                      : delta > 0
                        ? `↑${delta}`
                        : delta < 0
                          ? `↓${Math.abs(delta)}`
                          : "—";

                  return (
                    <tr
                      key={c.slug}
                      tabIndex={0}
                      className={clsx(
                        "group relative cursor-pointer transition-colors duration-300",
                        flash ? "bg-amber-500/15" : "hover:bg-slate-800/55",
                      )}
                      onClick={() => onRowNav(c.slug)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowNav(c.slug);
                        }
                      }}
                    >
                      <td className="px-2 py-1.5 tabular-nums text-slate-500 transition-transform duration-300">
                        {idx + 1}
                      </td>
                      <td
                        className={clsx(
                          "px-2 py-1.5 tabular-nums transition-all duration-300",
                          delta !== undefined && delta > 0 && "text-emerald-400",
                          delta !== undefined && delta < 0 && "text-rose-400",
                          (delta === 0 || delta === undefined) && "text-slate-500",
                        )}
                      >
                        {deltaLabel}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <CoinSymbol
                            symbol={c.symbol}
                            logoUrl={c.logoUrl}
                            name={c.name}
                            size="sm"
                            iconOnly
                          />
                          <div className="min-w-0 leading-tight">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="block truncate font-medium text-slate-50">
                                {c.name}
                              </span>
                              {isNew ? (
                                <span className="shrink-0 rounded bg-violet-500/25 px-1 py-0.5 text-[9px] font-semibold uppercase text-violet-200">
                                  New
                                </span>
                              ) : null}
                            </span>
                            <span className="text-[10px] text-slate-500">{c.symbol}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-100">
                        {formatPrice(c.priceUsd)}
                      </td>
                      <td
                        className={clsx(
                          "px-2 py-1.5 text-right tabular-nums",
                          typeof c.change24hPct === "number" && Number.isFinite(c.change24hPct)
                            ? c.change24hPct >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                            : "text-slate-500",
                        )}
                      >
                        {formatChangePct(c.change24hPct)}
                      </td>
                      <td
                        className="px-2 py-1.5 text-right tabular-nums text-slate-300"
                        title="Turnover vs median of this list (24h volume / mcap)"
                      >
                        {row.volumeSpikePct >= 0 ? "+" : ""}
                        {row.volumeSpikePct.toFixed(1)}%
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-semibold tabular-nums",
                            tierScoreClasses(row.tier.tier),
                          )}
                          title={`Window signal heat: ${row.signalHeat}`}
                        >
                          {row.attentionScore}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={clsx(
                            "inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            momentumPhaseClasses(row.momentumPhase),
                          )}
                        >
                          {momentumPhaseLabel(row.momentumPhase)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-slate-400">
                        <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] text-slate-300">
                          {row.narrativeTag}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={clsx(
                            "inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            row.quickSignal.className,
                          )}
                        >
                          {row.quickSignal.label}
                        </span>
                      </td>
                      <td className={clsx("px-2 py-1.5 text-[10px] font-medium", sm.className)}>
                        {sm.label}
                      </td>
                      <td className="px-2 py-1.5 text-center text-slate-500" title="Price acceleration vs weekly drift">
                        {row.momentum === "up" ? "↑" : row.momentum === "down" ? "↓" : "→"}
                      </td>
                      <td className="px-2 py-1.5">
                        <SparklineSvg
                          points={row.sparkline7d}
                          width={72}
                          height={26}
                          positive={sparkPos}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <div className="flex flex-col items-end gap-1 opacity-0 transition group-hover:opacity-100">
                          <a
                            href={buyUrls.coinbase}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Buy
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredCoins.length === 0 && (
              <p className="p-6 text-center text-xs text-slate-500">
                No coins in this sector filter right now.
              </p>
            )}
          </div>
        </>
      )}

      {mainTab === "narratives" && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-[640px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900/95 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Narrative</th>
                <th className="px-3 py-2 text-right font-medium">Trend score</th>
                <th className="px-3 py-2 font-medium">Explore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(narratives.length ? narratives : []).map((n) => (
                <tr key={n.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 text-slate-100">
                    <span className="font-medium">{n.name}</span>
                    {n.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.description}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-200">
                    {typeof n.trend_score === "number" ? n.trend_score.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Link href="/narratives" className="text-xs font-medium text-blue-400 hover:underline">
                      Narratives hub
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {narratives.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No narrative data from the engine yet.</p>
          ) : null}
        </div>
      )}

      {mainTab === "categories" && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-[800px] w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900/95 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">24h mcap %</th>
                <th className="px-3 py-2 font-medium">Flow</th>
                <th className="px-3 py-2 text-right font-medium">Vol / mcap</th>
                <th className="px-3 py-2 font-medium">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2 font-medium text-slate-100">{cat.name}</td>
                  <td
                    className={clsx(
                      "px-3 py-2 text-right tabular-nums",
                      (cat.market_cap_change_24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {formatChangePct(cat.market_cap_change_24h ?? Number.NaN)}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{cat.capital_flow}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                    {(cat.vol_to_mcap * 100).toFixed(2)}%
                  </td>
                  <td className="px-3 py-2">
                    <Link href="/categories" className="text-xs font-medium text-blue-400 hover:underline">
                      Categories
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">No category directory yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
