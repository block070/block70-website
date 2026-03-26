"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { HourIntelligencePayload } from "@/lib/crypto-hour-intelligence-types";
import { cryptoHourArticlePath } from "@/lib/crypto-hour-url";
import type { PublishedArticleDTO } from "@/lib/crypto-hour-dto";
import { CRYPTO_HOUR_DISPLAY_TZ, formatCryptoHourOnTheHour } from "@/lib/crypto-hour-dates";
import {
  hourSlotsForChicagoDay,
  pathForChicagoHour,
  pathForDay,
  pathForMonth,
  pathForYear,
  previousChicagoHour,
} from "@/lib/crypto-hour-routes";

import { NarrativeBubblePack } from "./narrative-bubble-pack";

export type DashboardNav = {
  year: number;
  month: number;
  day: number;
  hour: number;
};

type SummaryMode = "quick" | "deep" | "trader" | "whale";

function matchesKeyword(a: PublishedArticleDTO, term: string | null): boolean {
  if (!term) return true;
  const t = `${a.title}\n${a.body_markdown}`.toLowerCase();
  return t.includes(term.toLowerCase());
}

export function CryptoHourDashboard({
  intel,
  articles,
  nav,
  autoRefreshNote,
}: {
  intel: HourIntelligencePayload;
  articles: PublishedArticleDTO[];
  nav: DashboardNav;
  /** e.g. "Refreshes on the hour" for today view */
  autoRefreshNote?: string;
}) {
  const [kwFilter, setKwFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<SummaryMode>("quick");

  const filtered = useMemo(
    () => articles.filter((a) => matchesKeyword(a, kwFilter)),
    [articles, kwFilter],
  );

  const slots = hourSlotsForChicagoDay(nav.year, nav.month, nav.day);

  const prevHour = previousChicagoHour(nav.year, nav.month, nav.day, nav.hour);
  const prevHourPath = pathForChicagoHour(
    prevHour.year,
    prevHour.month,
    prevHour.day,
    prevHour.hour,
    0,
  );

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

  const impactLabel =
    intel.marketImpact.label === "high"
      ? "High"
      : intel.marketImpact.label === "medium"
        ? "Medium"
        : "Low";

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-200">
      <div className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">
              Crypto On The Hour
            </h1>
            <p className="text-[11px] text-slate-500">
              US Central hour · {intel.articleCount} briefs · updated{" "}
              {new Date(intel.hourStartIso).toLocaleString("en-US", {
                timeZone: CRYPTO_HOUR_DISPLAY_TZ,
              })}
              {autoRefreshNote ? ` · ${autoRefreshNote}` : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/crypto-on-the-hour"
              className="rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-slate-300 hover:border-emerald-600/50"
            >
              Today
            </Link>
            <Link
              href={prevHourPath}
              className="rounded-md border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-slate-300 hover:border-emerald-600/50"
            >
              Previous hour
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[240px_1fr_360px]">
        {/* Left — timeline */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 shadow-lg shadow-black/20">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Navigate
            </p>
            <nav className="flex flex-col gap-1.5 text-[12px]">
              <Link className="text-blue-400 hover:text-blue-300" href={pathForYear(nav.year)}>
                Year {nav.year}
              </Link>
              <Link className="text-blue-400 hover:text-blue-300" href={pathForMonth(nav.year, nav.month)}>
                Month {nav.month}/{nav.year}
              </Link>
              <Link className="text-blue-400 hover:text-blue-300" href={pathForDay(nav.year, nav.month, nav.day)}>
                Day {nav.month}/{nav.day}/{nav.year}
              </Link>
            </nav>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 shadow-lg shadow-black/20">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Hour scrub
            </p>
            <input
              type="range"
              min={0}
              max={23}
              value={nav.hour}
              onChange={(e) => {
                const h = parseInt(e.target.value, 10);
                window.location.href = pathForChicagoHour(nav.year, nav.month, nav.day, h, 0);
              }}
              className="w-full accent-emerald-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>00:00</span>
              <span className="text-slate-300">{nav.hour.toString().padStart(2, "0")}:00</span>
              <span>23:00</span>
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto text-[10px] text-slate-500">
              {slots.map((s) => (
                <Link
                  key={s.path}
                  href={s.path}
                  className={`mb-0.5 block rounded px-1 py-0.5 hover:bg-slate-800/60 ${
                    s.path === pathForChicagoHour(nav.year, nav.month, nav.day, nav.hour, 0)
                      ? "bg-emerald-950/50 text-emerald-300"
                      : ""
                  }`}
                >
                  {s.label} CT
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 shadow-lg shadow-black/20">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
      Calendar
            </p>
            <input
              type="date"
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[12px] text-slate-200"
              defaultValue={`${nav.year}-${String(nav.month).padStart(2, "0")}-${String(nav.day).padStart(2, "0")}`}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const [y, m, d] = v.split("-").map((x) => parseInt(x, 10));
                window.location.href = pathForDay(y, m, d);
              }}
            />
          </div>
        </aside>

        {/* Center */}
        <main className="min-w-0 space-y-4">
          <section className="rounded-xl border border-slate-800/80 bg-gradient-to-br from-slate-950/90 via-slate-900/40 to-slate-950/90 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="mb-3 flex flex-wrap gap-2">
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
                      ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-200"
                      : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "quick" ? (
              <ul className="list-inside list-disc space-y-1.5 text-sm">{summaryText}</ul>
            ) : (
              <p className="text-sm leading-relaxed text-slate-300/95">{summaryText}</p>
            )}
          </section>

          {intel.whatChanged ? (
            <section className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-4 backdrop-blur-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
                What changed vs last hour
              </h2>
              <div className="mt-2 grid gap-3 text-[12px] sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase text-slate-500">New keywords</p>
                  <p className="text-slate-300">
                    {intel.whatChanged.newKeywords.length
                      ? intel.whatChanged.newKeywords.join(", ")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Faded</p>
                  <p className="text-slate-300">
                    {intel.whatChanged.droppedKeywords.length
                      ? intel.whatChanged.droppedKeywords.join(", ")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Sentiment delta</p>
                  <p
                    className={
                      intel.whatChanged.sentimentDelta > 0
                        ? "text-emerald-400"
                        : intel.whatChanged.sentimentDelta < 0
                          ? "text-red-400"
                          : "text-slate-400"
                    }
                  >
                    {intel.whatChanged.sentimentDelta > 0 ? "+" : ""}
                    {intel.whatChanged.sentimentDelta.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500">New entities</p>
                  <p className="text-slate-300">
                    {intel.whatChanged.newEntities.length
                      ? intel.whatChanged.newEntities.join(", ")
                      : "—"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Article feed
                {kwFilter ? (
                  <span className="ml-2 text-emerald-400">· filter: {kwFilter}</span>
                ) : null}
              </h2>
              {kwFilter ? (
                <button
                  type="button"
                  className="text-[11px] text-blue-400 hover:text-blue-300"
                  onClick={() => setKwFilter(null)}
                >
                  Clear filter
                </button>
              ) : null}
            </div>
            <ul className="divide-y divide-slate-800/90 rounded-xl border border-slate-800/80 bg-slate-950/40">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-slate-500">
                  No articles in this hour{kwFilter ? " for this keyword" : ""}.
                </li>
              ) : (
                filtered.map((a) => (
                  <li key={a.topic_id}>
                    <Link
                      href={cryptoHourArticlePath(a.topic_slug)}
                      className="block px-4 py-3 transition hover:bg-slate-800/40"
                    >
                      <span className="font-medium text-slate-100">{a.title}</span>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatCryptoHourOnTheHour(new Date(a.updated_at))} ·{" "}
                        <span className="text-slate-400">{a.topic_slug}</span>
                      </p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        </main>

        {/* Right rail */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <NarrativeBubblePack
            keywords={intel.keywords}
            activeTerm={kwFilter}
            onPick={setKwFilter}
          />

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 shadow-lg shadow-black/20">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Hour sentiment
            </p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                intel.hourSentiment > 8
                  ? "text-emerald-400"
                  : intel.hourSentiment < -8
                    ? "text-red-400"
                    : "text-slate-200"
              }`}
            >
              {intel.hourSentiment.toFixed(0)}
            </p>
            <p className="text-[11px] text-slate-500">Lexicon-based −100…+100 (v1)</p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 shadow-lg shadow-black/20">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Market impact score
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
              {intel.marketImpact.score}{" "}
              <span className="text-base font-normal text-slate-500">/ 100</span>
            </p>
            <p className="text-[12px] text-emerald-400/90">{impactLabel} intensity</p>
            <div className="mt-2 space-y-1 text-[10px] text-slate-500">
              <div className="flex justify-between">
                <span>Volume</span>
                <span>{intel.marketImpact.components.articleVolume}</span>
              </div>
              <div className="flex justify-between">
                <span>Top coins</span>
                <span>{intel.marketImpact.components.topCoinMentions}</span>
              </div>
              <div className="flex justify-between">
                <span>Sentiment</span>
                <span>{intel.marketImpact.components.sentimentIntensity}</span>
              </div>
              <div className="flex justify-between">
                <span>Sources</span>
                <span>{intel.marketImpact.components.sourceCredibility}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 shadow-lg shadow-black/20">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Trending entities
            </p>
            <p className="mt-2 text-[11px] text-slate-500">Tickers</p>
            <p className="text-[12px] text-slate-200">
              {intel.entities.coins.length ? intel.entities.coins.join(", ") : "—"}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">Names / orgs</p>
            <p className="text-[12px] text-slate-200">
              {intel.entities.organizations.length ? intel.entities.organizations.join(", ") : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-[10px] leading-relaxed text-slate-500 shadow-lg shadow-black/20">
            <p className="font-medium text-slate-400">Roadmap</p>
            <p className="mt-1">
              Whale wallets, personalization, streaming audio, and push alerts plug into this layout
              without changing routes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
