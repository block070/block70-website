"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Bookmark, BookmarkCheck, Sparkles, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import type { AIInsightDto, MarketNarrativeDto } from "@/lib/api";
import type { RadarCoinEnrichment } from "@/lib/radar-opportunity";
import {
  discoveryScorePercent,
  earlySignalBadges,
  getEnrichmentForSymbol,
  headlineForEvent,
  passesMarketFilters,
  pickNarrativeLine,
  riskTierFromSignals,
  signalTypeLabel,
} from "@/lib/radar-opportunity";
import type { RadarEventDto } from "@/lib/types";

const WATCH_KEY = "b70-radar-watch";
const NOTIFY_KEY = "b70-radar-notify-enabled";
const SESSION_NOTIFIED = "b70-radar-session-notified";

type SortKey = "discovery" | "event_score" | "recency" | "market_cap";

export type RadarOpportunitiesClientProps = {
  events: RadarEventDto[];
  enrichmentBySymbol: Record<string, RadarCoinEnrichment>;
  narratives: MarketNarrativeDto[];
  insights: AIInsightDto[];
  generatedAt: string;
};

function readWatchList(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set((Array.isArray(arr) ? arr : []).map((s) => String(s).toUpperCase()));
  } catch {
    return new Set();
  }
}

function writeWatchList(s: Set<string>) {
  localStorage.setItem(WATCH_KEY, JSON.stringify([...s]));
}

function readNotifyPref(): boolean {
  return localStorage.getItem(NOTIFY_KEY) === "1";
}

function writeNotifyPref(v: boolean) {
  localStorage.setItem(NOTIFY_KEY, v ? "1" : "0");
}

function tierLabel(tier: ReturnType<typeof riskTierFromSignals>): string {
  if (tier === "speculative") return "Attention-heavy";
  if (tier === "balanced") return "Balanced signals";
  return "Mixed / early";
}

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function RadarOpportunitiesClient({
  events,
  enrichmentBySymbol,
  narratives,
  insights,
  generatedAt,
}: RadarOpportunitiesClientProps) {
  const enrichMap = useMemo(() => new Map(Object.entries(enrichmentBySymbol)), [enrichmentBySymbol]);
  const hasEnrichment = enrichMap.size > 0;

  const [sortBy, setSortBy] = useState<SortKey>("discovery");
  const [minScorePct, setMinScorePct] = useState(35);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [lowMcap, setLowMcap] = useState(false);
  const [highVolGrowth, setHighVolGrowth] = useState(false);
  const [newListingHint, setNewListingHint] = useState(false);
  const [watch, setWatch] = useState<Set<string>>(new Set());
  const [notifyOn, setNotifyOn] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setWatch(readWatchList());
    setNotifyOn(readNotifyPref());
    setHydrated(true);
  }, []);

  const allTypes = useMemo(() => {
    const s = new Set<string>();
    for (const e of events) (e.signal_types ?? []).forEach((x) => s.add(x));
    return [...s].sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      const sym = (ev.token_symbol ?? "").toUpperCase();
      const dsc = discoveryScorePercent(ev);
      if (dsc < minScorePct) return false;
      if (typeFilter && !(ev.signal_types ?? []).includes(typeFilter)) return false;
      const en = getEnrichmentForSymbol(enrichMap, sym);
      if (
        !passesMarketFilters(en, {
          lowMcap: lowMcap,
          highVolumeGrowth: highVolGrowth,
          newListing: newListingHint,
        })
      )
        return false;
      return true;
    });
  }, [events, minScorePct, typeFilter, enrichMap, lowMcap, highVolGrowth, newListingHint]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const sa = (a.token_symbol ?? "").toUpperCase();
      const sb = (b.token_symbol ?? "").toUpperCase();
      const ea = getEnrichmentForSymbol(enrichMap, sa);
      const eb = getEnrichmentForSymbol(enrichMap, sb);
      if (sortBy === "market_cap") {
        const ma = ea?.market_cap_usd ?? 0;
        const mb = eb?.market_cap_usd ?? 0;
        return mb - ma;
      }
      if (sortBy === "event_score") {
        return (b.event_score ?? 0) - (a.event_score ?? 0);
      }
      if (sortBy === "recency") {
        const ta = a.latest_signal_at ? new Date(a.latest_signal_at).getTime() : 0;
        const tb = b.latest_signal_at ? new Date(b.latest_signal_at).getTime() : 0;
        return tb - ta;
      }
      return discoveryScorePercent(b) - discoveryScorePercent(a);
    });
    return copy;
  }, [filtered, sortBy, enrichMap]);

  const trending = useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => discoveryScorePercent(b) - discoveryScorePercent(a));
    return copy.slice(0, 10);
  }, [events]);

  const toggleWatch = useCallback((sym: string) => {
    const k = sym.toUpperCase();
    setWatch((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      writeWatchList(next);
      return next;
    });
  }, []);

  const requestNotify = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifyOn(true);
      writeNotifyPref(true);
    }
  }, []);

  const disableNotify = useCallback(() => {
    setNotifyOn(false);
    writeNotifyPref(false);
  }, []);

  useEffect(() => {
    if (!hydrated || !notifyOn || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    let sessionSet: Set<string>;
    try {
      const raw = sessionStorage.getItem(SESSION_NOTIFIED);
      sessionSet = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      sessionSet = new Set();
    }
    for (const ev of sorted.slice(0, 15)) {
      const sym = (ev.token_symbol ?? "").toUpperCase();
      if (!watch.has(sym)) continue;
      const dsc = discoveryScorePercent(ev);
      if (dsc < 55) continue;
      const key = `${sym}-${new Date().toDateString()}`;
      if (sessionSet.has(key)) continue;
      sessionSet.add(key);
      try {
        sessionStorage.setItem(SESSION_NOTIFIED, JSON.stringify([...sessionSet]));
      } catch {
        /* ignore */
      }
      new Notification(`Radar: ${sym}`, {
        body: headlineForEvent(ev).slice(0, 120),
        tag: key,
      });
      break;
    }
  }, [hydrated, notifyOn, sorted, watch]);

  return (
    <div className="space-y-8 pb-12">
      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm md:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Early signals
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--b70-text)]">
          Watchlist &amp; on-device alerts
        </h2>
        <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
          Book tokens with the bookmark on each card. Alerts use your browser only while Block70 is open; they are
          experimental and not a substitute for exchange or portfolio tooling.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {notifyOn && typeof Notification !== "undefined" && Notification.permission === "granted" ? (
            <button
              type="button"
              onClick={disableNotify}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-1.5 text-xs font-medium text-[var(--b70-text)]"
            >
              <BellOff className="h-3.5 w-3.5" aria-hidden />
              Disable alerts
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void requestNotify()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--b70-crypto-blue)]/40 bg-[var(--b70-crypto-blue)]/10 px-3 py-1.5 text-xs font-medium text-[var(--b70-crypto-blue)]"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden />
              Enable browser alerts
            </button>
          )}
          <span className="text-[11px] text-[var(--b70-text-muted)]">
            {watch.size} watched · updated {new Date(generatedAt).toLocaleString()}
          </span>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Fast movers</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {trending.map((ev) => {
            const sym = ev.token_symbol ?? "—";
            const dsc = discoveryScorePercent(ev);
            return (
              <Link
                key={sym}
                href={`/radar/${encodeURIComponent(sym)}`}
                className={clsx(
                  "shrink-0 rounded-xl border px-3 py-2 text-left transition-colors",
                  "border-[var(--b70-border)] bg-[var(--b70-card)] hover:border-[var(--b70-crypto-blue)]/40",
                )}
              >
                <p className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-[var(--b70-text)]">
                  {sym}
                </p>
                <p className="text-[10px] text-[var(--b70-text-muted)]">
                  Score {dsc}%
                  {ev.event_score == null && ev.severity_score != null ? " · severity" : ""}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Filters</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs">
            <span className="text-[var(--b70-text-muted)]">Min Block70 radar score (0–100)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={minScorePct}
              onChange={(e) => setMinScorePct(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">{minScorePct}</span>
          </label>
          <label className="block text-xs">
            <span className="text-[var(--b70-text-muted)]">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="mt-1 w-full rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1.5 text-[var(--b70-text)]"
            >
              <option value="discovery">Radar composite</option>
              <option value="event_score">Engine event score</option>
              <option value="recency">Latest activity</option>
              <option value="market_cap">Market cap (enriched)</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="text-[var(--b70-text-muted)]">Signal type</span>
            <select
              value={typeFilter ?? "all"}
              onChange={(e) => setTypeFilter(e.target.value === "all" ? null : e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1.5 text-[var(--b70-text)]"
            >
              <option value="all">All types</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>
                  {signalTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 border-t border-[var(--b70-border)] pt-4">
          <p className="text-[11px] font-medium text-[var(--b70-text)]">Market-linked presets</p>
          {!hasEnrichment ? (
            <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400/90">
              Market filters need coin linkage — coin directory unavailable for this session. Radar filters still work.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
              Uses top-of-book coin list matches by symbol; ambiguous tickers may map to the highest-ranked coin.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--b70-text)]">
              <input
                type="checkbox"
                checked={lowMcap}
                disabled={!hasEnrichment}
                onChange={(e) => setLowMcap(e.target.checked)}
              />
              Smaller cap tilt (&lt; $500M mcap)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--b70-text)]">
              <input
                type="checkbox"
                checked={highVolGrowth}
                disabled={!hasEnrichment}
                onChange={(e) => setHighVolGrowth(e.target.checked)}
              />
              Volume / momentum tilt
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--b70-text)]">
              <input
                type="checkbox"
                checked={newListingHint}
                disabled={!hasEnrichment}
                onChange={(e) => setNewListingHint(e.target.checked)}
              />
              Long-tail rank hint
            </label>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">
          Gems ({sorted.length})
        </h2>
        {sorted.length === 0 ? (
          <p className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)] p-6 text-sm text-[var(--b70-text-muted)]">
            No opportunities match filters. Relax score threshold or clear market presets.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((ev) => {
              const sym = (ev.token_symbol ?? "—").toUpperCase();
              const en = getEnrichmentForSymbol(enrichMap, sym);
              const narrative = pickNarrativeLine(sym, narratives, insights);
              const tier = riskTierFromSignals(ev);
              const badges = earlySignalBadges(ev);
              const headline = headlineForEvent(ev);
              const dsc = discoveryScorePercent(ev);
              const watched = watch.has(sym);

              return (
                <li
                  key={sym}
                  className="flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-[family-name:var(--font-jetbrains)] text-base font-semibold text-[var(--b70-text)]">
                        {sym}
                      </p>
                      {ev.chain ? (
                        <p className="text-[10px] text-[var(--b70-text-muted)]">{ev.chain}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleWatch(sym)}
                      className="rounded-lg border border-[var(--b70-border)] p-1.5 text-[var(--b70-text-muted)] hover:text-[var(--b70-crypto-blue)]"
                      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      {watched ? (
                        <BookmarkCheck className="h-4 w-4 text-[var(--b70-crypto-blue)]" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-2xl font-semibold text-[var(--b70-crypto-blue)]">
                    {dsc}%
                  </p>
                  <p className="text-[10px] text-[var(--b70-text-muted)]" title="Weighted from radar engine fields">
                    Block70 radar composite (not investment advice)
                  </p>

                  <p className="mt-2 line-clamp-3 text-xs text-[var(--b70-text-muted)]">{headline}</p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {badges.map((b) => (
                      <span
                        key={b}
                        className="rounded-md bg-[var(--b70-bg)] px-1.5 py-0.5 text-[10px] text-[var(--b70-text)]"
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  <p className="mt-2 text-[11px] text-[var(--b70-text-muted)]">
                    Risk posture:{" "}
                    <span className="font-medium text-[var(--b70-text)]">{tierLabel(tier)}</span>
                  </p>

                  <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
                    Narrative:{" "}
                    <span className="text-[var(--b70-text)]">
                      {narrative ?? "Not linked to narratives feed"}
                    </span>
                  </p>

                  {en && hasEnrichment ? (
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-[var(--b70-text-muted)]">
                      <dt>Mcap</dt>
                      <dd className="text-right font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                        {formatUsd(en.market_cap_usd)}
                        {en.match_quality === "ambiguous" ? " *" : ""}
                      </dd>
                      <dt>Vol 24h</dt>
                      <dd className="text-right font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                        {formatUsd(en.volume_24h_usd)}
                      </dd>
                    </dl>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <Link
                      href={`/radar/${encodeURIComponent(sym)}`}
                      className="rounded-lg bg-[var(--b70-crypto-blue)]/15 px-3 py-1.5 text-xs font-medium text-[var(--b70-crypto-blue)] hover:bg-[var(--b70-crypto-blue)]/25"
                    >
                      Open radar
                    </Link>
                    {en?.slug ? (
                      <Link
                        href={`/coins/${encodeURIComponent(en.slug)}`}
                        className="rounded-lg border border-[var(--b70-border)] px-3 py-1.5 text-xs font-medium text-[var(--b70-text)] hover:border-[var(--b70-crypto-blue)]/40"
                      >
                        Coin page
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[10px] text-[var(--b70-text-muted)]">
        For on-chain movement context see{" "}
        <Link href="/capitalflow" className="text-[var(--b70-crypto-blue)] hover:underline">
          capital flow
        </Link>
        .
        Signals are automated and may be wrong. Not financial advice.
      </p>
    </div>
  );
}
