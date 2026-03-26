"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { HourIntelligencePayload, SentimentTrendPoint } from "@/lib/crypto-hour-intelligence-types";
import { CRYPTO_HOUR_DISPLAY_TZ, formatCryptoHourOnTheHour } from "@/lib/crypto-hour-dates";
import type { PublishedArticleDTO } from "@/lib/crypto-hour-dto";
import { cryptoHourArticlePath } from "@/lib/crypto-hour-url";
import {
  hourSlotsForChicagoDay,
  pathForChicagoHour,
  pathForDay,
  pathForMonth,
  pathForYear,
  pathYesterdayFromHourStart,
  previousChicagoHour,
} from "@/lib/crypto-hour-routes";

import {
  NarrativeBubblePack,
  NarrativeMapModeToggle,
  type NarrativeMapMode,
} from "./narrative-bubble-pack";

export type DashboardNav = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

type SummaryMode = "quick" | "deep" | "trader" | "whale";
type FeedSort = "impact" | "bullish" | "bearish";

const BULLISH_WORDS = new Set([
  "surge",
  "rally",
  "gain",
  "soar",
  "bull",
  "bullish",
  "rise",
  "recover",
  "rebound",
  "approve",
  "high",
  "growth",
]);
const BEARISH_WORDS = new Set([
  "crash",
  "plunge",
  "drop",
  "bear",
  "bearish",
  "hack",
  "ban",
  "lawsuit",
  "fear",
  "selloff",
]);

function stripMd(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_]/g, " ");
}

function sentimentLabel(score: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (score > 8) return "BULLISH";
  if (score < -8) return "BEARISH";
  return "NEUTRAL";
}

function docToneScore(text: string): number {
  const t = stripMd(text).toLowerCase().split(/\s+/);
  let b = 0;
  for (const w of t) {
    if (BULLISH_WORDS.has(w)) b++;
    if (BEARISH_WORDS.has(w)) b--;
  }
  return b;
}

function articleTags(a: PublishedArticleDTO, coins: string[]): string[] {
  const tags = new Set<string>();
  const titleU = a.title.toUpperCase();
  for (const c of coins.slice(0, 30)) {
    if (titleU.includes(c) || a.title.toLowerCase().includes(c.toLowerCase())) tags.add(c);
  }
  const low = a.title.toLowerCase();
  if (/sec|regulation|bill|court|lawsuit/.test(low)) tags.add("Regulation");
  if (/etf|blackrock|ishares/.test(low)) tags.add("ETF");
  if (/hack|exploit|breach|drain/.test(low)) tags.add("Security");
  if (/defi|dex|staking|yield/.test(low)) tags.add("DeFi");
  return [...tags].slice(0, 5);
}

function articleBullets(a: PublishedArticleDTO): string[] {
  const plain = stripMd(a.body_markdown).replace(/\s+/g, " ").trim();
  const sentences = plain.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  return sentences.slice(0, 3).map((s) => (s.length > 160 ? `${s.slice(0, 157)}…` : s));
}

function matchesKeyword(a: PublishedArticleDTO, term: string | null): boolean {
  if (!term) return true;
  const t = `${a.title}\n${a.body_markdown}`.toLowerCase();
  return t.includes(term.toLowerCase());
}

/** Recharts ResponsiveContainer reads `window`; must not run during SSR or Node can crash → connection reset. */
function SentimentTrendChart({ chartData }: { chartData: { t: string; s: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-28 w-full rounded-lg bg-slate-800/40" aria-hidden />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[-100, 100]} tick={{ fill: "#64748b", fontSize: 10 }} width={32} />
        <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
        <Tooltip
          contentStyle={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: 8,
            fontSize: 11,
          }}
          formatter={(v) => [`${Number(v).toFixed(0)}`, "Sentiment"]}
        />
        <Line
          type="monotone"
          dataKey="s"
          stroke="#34d399"
          strokeWidth={2}
          dot={{ r: 3, fill: "#10b981" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CryptoHourDashboard({
  intel,
  articles,
  nav,
  sentimentTrend,
  autoRefreshNote,
}: {
  intel: HourIntelligencePayload;
  articles: PublishedArticleDTO[];
  nav: DashboardNav;
  sentimentTrend: SentimentTrendPoint[];
  autoRefreshNote?: string;
}) {
  const [kwFilter, setKwFilter] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<NarrativeMapMode>("words");
  const [mode, setMode] = useState<SummaryMode>("quick");
  const [feedSort, setFeedSort] = useState<FeedSort>("impact");

  const filtered = useMemo(
    () => articles.filter((a) => matchesKeyword(a, kwFilter)),
    [articles, kwFilter],
  );

  const sortedFeed = useMemo(() => {
    const list = [...filtered];
    if (feedSort === "impact") {
      list.sort(
        (a, b) =>
          stripMd(b.title + b.body_markdown).length - stripMd(a.title + a.body_markdown).length,
      );
    } else if (feedSort === "bullish") {
      list.sort((a, b) => docToneScore(b.body_markdown) - docToneScore(a.body_markdown));
    } else {
      list.sort((a, b) => docToneScore(a.body_markdown) - docToneScore(b.body_markdown));
    }
    return list;
  }, [filtered, feedSort]);

  const slots = hourSlotsForChicagoDay(nav.year, nav.month, nav.day);
  const prevHour = previousChicagoHour(nav.year, nav.month, nav.day, nav.hour);
  const prevHourPath = pathForChicagoHour(
    prevHour.year,
    prevHour.month,
    prevHour.day,
    prevHour.hour,
    0,
  );
  const yesterdayPath = pathYesterdayFromHourStart(intel.hourStartIso);

  const tone = sentimentLabel(intel.hourSentiment);
  const delta =
    intel.whatChanged?.sentimentDelta ?? intel.hourSentiment - (sentimentTrend.at(-2)?.sentiment ?? 0);

  const chartData = sentimentTrend.map((p) => ({
    t: p.label,
    s: p.sentiment,
  }));

  const summaryText =
    mode === "quick"
      ? intel.summaries.quick.map((b, i) => (
          <li key={i} className="text-slate-300/95">
            {b}
          </li>
        ))
      : mode === "deep"
        ? intel.summaries.deep
        : mode === "trader"
          ? intel.summaries.trader
          : intel.summaries.whale;

  const impactLabelUi =
    intel.marketImpact.label === "high"
      ? "HIGH IMPACT"
      : intel.marketImpact.label === "medium"
        ? "MEDIUM IMPACT"
        : "LOW IMPACT";

  const gradientPct = Math.max(0, Math.min(100, ((intel.hourSentiment + 100) / 200) * 100));

  return (
    <div
      className="min-h-screen bg-[#05070b] text-slate-200 antialiased"
      data-coh-ui="intel-v2"
    >
      {/* Sticky control bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/90 bg-[#070a0f]/95 shadow-lg shadow-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white md:text-lg">
                Crypto On The Hour
              </h1>
              <p className="text-[10px] text-slate-500 md:text-[11px]">
                Last updated{" "}
                {new Date().toLocaleString("en-US", {
                  timeZone: CRYPTO_HOUR_DISPLAY_TZ,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZoneName: "short",
                })}
                {autoRefreshNote ? ` · ${autoRefreshNote}` : ""}
                {" · "}
                {intel.articleCount} articles in window
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/crypto-on-the-hour"
                className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-900/40"
              >
                Today
              </Link>
              <Link
                href={yesterdayPath}
                className="rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-slate-500"
              >
                Yesterday
              </Link>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="hidden sm:inline">Custom</span>
                <input
                  type="date"
                  className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
                  defaultValue={`${nav.year}-${String(nav.month).padStart(2, "0")}-${String(nav.day).padStart(2, "0")}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const [y, m, d] = v.split("-").map((x) => parseInt(x, 10));
                    window.location.href = pathForDay(y, m, d);
                  }}
                />
              </label>
            </div>
          </div>
          {/* Horizontal hour timeline */}
          <div className="scrollbar-thin overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1">
              {slots.map((s) => {
                const active = s.path === pathForChicagoHour(nav.year, nav.month, nav.day, nav.hour, 0);
                return (
                  <Link
                    key={s.path}
                    href={s.path}
                    className={`min-w-[2.75rem] rounded-md border px-2 py-1 text-center text-[10px] font-medium tabular-nums transition-all duration-200 ${
                      active
                        ? "border-amber-500/70 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                        : "border-slate-700/80 bg-slate-900/40 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                    }`}
                  >
                    {s.label.replace(":00", "")}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        {/* 1 — Narrative map full width */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <NarrativeMapModeToggle mode={mapMode} onMode={setMapMode} />
            {kwFilter ? (
              <button
                type="button"
                className="text-[11px] font-medium text-amber-400 hover:text-amber-300"
                onClick={() => setKwFilter(null)}
              >
                Clear keyword filter: {kwFilter}
              </button>
            ) : null}
          </div>
          <NarrativeBubblePack
            keywords={intel.keywords}
            entities={intel.entities}
            articles={articles}
            mode={mapMode}
            activeTerm={kwFilter}
            onPick={setKwFilter}
          />
        </section>

        {/* 2 — Sentiment + Market impact */}
        <section className="grid gap-4 md:grid-cols-2 animate-in fade-in duration-500">
          <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-950/90 to-slate-900/30 p-5 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Hour sentiment
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <span
                className={`text-2xl font-bold tracking-tight md:text-3xl ${
                  tone === "BULLISH"
                    ? "text-emerald-400"
                    : tone === "BEARISH"
                      ? "text-red-400"
                      : "text-slate-300"
                }`}
              >
                {tone}
              </span>
              <span className="text-3xl font-semibold tabular-nums text-white md:text-4xl">
                {intel.hourSentiment > 0 ? "+" : ""}
                {intel.hourSentiment.toFixed(0)}
              </span>
              <span
                className={`mb-1 text-sm tabular-nums ${
                  delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-slate-500"
                }`}
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"}{" "}
                {delta !== 0 ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}` : "0"} vs prior hour
              </span>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 via-slate-500 to-emerald-500 transition-[width] duration-500"
                style={{ width: "100%", opacity: 0.35 }}
              />
              <div
                className="relative -mt-3 h-3 w-full"
                title="Position shows score on −100 (red) … +100 (green)"
              >
                <div
                  className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded-sm bg-white shadow-lg transition-all duration-500"
                  style={{ left: `${gradientPct}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Lexicon-based index · compares last 6 hours below
            </p>
            <div className="mt-4 h-28 w-full">
              <SentimentTrendChart chartData={chartData} />
            </div>
          </div>

          <div
            className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-950/90 to-slate-900/30 p-5 shadow-xl"
            title="Weighted blend of article volume, major-coin mentions, sentiment strength, and source-quality prior (v1)."
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Market impact
            </p>
            <p className="mt-2 text-lg font-semibold text-amber-200/95">{impactLabelUi}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-white">
              {intel.marketImpact.score}
              <span className="text-lg font-normal text-slate-500"> /100</span>
            </p>
            <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-slate-600 via-amber-500 to-emerald-400 transition-all duration-700"
                style={{ width: `${intel.marketImpact.score}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2 text-[11px] text-slate-400">
              <li className="flex justify-between border-b border-slate-800/50 pb-1">
                <span>Articles in hour</span>
                <span className="tabular-nums text-slate-200">{intel.articleCount}</span>
              </li>
              <li className="flex justify-between border-b border-slate-800/50 pb-1">
                <span>Top-coin signal (component)</span>
                <span className="tabular-nums text-slate-200">
                  {intel.marketImpact.components.topCoinMentions}
                </span>
              </li>
              <li className="flex justify-between border-b border-slate-800/50 pb-1">
                <span>Sentiment strength</span>
                <span className="tabular-nums text-slate-200">
                  {intel.marketImpact.components.sentimentIntensity}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Source weight (prior)</span>
                <span className="tabular-nums text-slate-200">
                  {intel.marketImpact.components.sourceCredibility}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
              Hover this card for the formula summary. Higher scores = more concurrent headlines, more
              large-cap tickers, sharper tone, and baseline credibility prior.
            </p>
          </div>
        </section>

        {/* 3 — What changed */}
        {intel.whatChanged ? (
          <section className="rounded-xl border border-amber-500/25 bg-amber-950/10 p-5 shadow-lg">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-200/90">
              What changed vs previous hour
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-medium uppercase text-slate-500">New keywords</p>
                <p className="mt-1 text-sm text-slate-200">
                  {intel.whatChanged.newKeywords.length
                    ? intel.whatChanged.newKeywords.join(", ")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase text-slate-500">Dropped</p>
                <p className="mt-1 text-sm text-slate-200">
                  {intel.whatChanged.droppedKeywords.length
                    ? intel.whatChanged.droppedKeywords.join(", ")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase text-slate-500">Sentiment shift</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    intel.whatChanged.sentimentDelta > 0
                      ? "text-emerald-400"
                      : intel.whatChanged.sentimentDelta < 0
                        ? "text-red-400"
                        : "text-slate-400"
                  }`}
                >
                  {intel.whatChanged.sentimentDelta > 0 ? "+" : ""}
                  {intel.whatChanged.sentimentDelta.toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase text-slate-500">New entities</p>
                <p className="mt-1 text-sm text-slate-200">
                  {intel.whatChanged.newEntities.length
                    ? intel.whatChanged.newEntities.join(", ")
                    : "—"}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* AI summaries (compact) */}
        <section className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
          <div className="mb-2 flex flex-wrap gap-2">
            {(
              [
                ["quick", "Quick"],
                ["deep", "Deep"],
                ["trader", "Trader"],
                ["whale", "Whale"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  mode === k
                    ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                    : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "quick" ? (
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">{summaryText}</ul>
          ) : (
            <p className="text-sm leading-relaxed text-slate-300">{summaryText}</p>
          )}
        </section>

        {/* 4 — Article feed */}
        <section className="pb-12">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Briefings
              {kwFilter ? (
                <span className="ml-2 font-normal text-amber-400">· {kwFilter}</span>
              ) : null}
            </h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["impact", "Most impactful"],
                  ["bullish", "Most bullish"],
                  ["bearish", "Most bearish"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFeedSort(k)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] transition ${
                    feedSort === k
                      ? "border-sky-500/50 bg-sky-950/30 text-sky-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-slate-800/90 rounded-xl border border-slate-800/80 bg-slate-950/30">
            {sortedFeed.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-slate-500">
                No articles in this hour{kwFilter ? " for this filter" : ""}.
              </li>
            ) : (
              sortedFeed.map((a) => {
                const tags = articleTags(a, intel.entities.coins);
                const bullets = articleBullets(a);
                return (
                  <li key={a.topic_id} className="transition-colors hover:bg-slate-900/40">
                    <Link href={cryptoHourArticlePath(a.topic_slug)} className="block px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="rounded border border-slate-700/80 bg-slate-900/60 px-1.5 py-0.5 text-[10px] text-slate-400"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-2 text-base font-semibold leading-snug text-white">{a.title}</h3>
                      {bullets.length > 0 ? (
                        <ul className="mt-2 list-inside list-disc space-y-0.5 text-[12px] text-slate-400">
                          {bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="mt-2 text-[10px] text-slate-600">
                        {formatCryptoHourOnTheHour(new Date(a.updated_at))} · {a.topic_slug}
                      </p>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
          <p className="mt-6 text-center text-[10px] text-slate-600">
            <Link href={pathForYear(nav.year)} className="text-slate-500 hover:text-slate-400">
              Year {nav.year}
            </Link>
            {" · "}
            <Link
              href={pathForMonth(nav.year, nav.month)}
              className="text-slate-500 hover:text-slate-400"
            >
              {nav.month}/{nav.year}
            </Link>
            {" · "}
            <Link
              href={pathForDay(nav.year, nav.month, nav.day)}
              className="text-slate-500 hover:text-slate-400"
            >
              Calendar day
            </Link>
            {" · "}
            <Link href={prevHourPath} className="text-slate-500 hover:text-slate-400">
              Previous hour
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
