"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import { clsx } from "clsx";
import { formatChangePct, formatCompactUsd } from "@/lib/format";
import type { HomeDashboardPayload } from "@/lib/home/build-home-dashboard";
import type { Opportunity } from "@/lib/types";
import { HomeSignalsStrip } from "@/components/home/home-signals-strip";
import { Block70ScoreBadge } from "@/components/home/block70-score-badge";
import { ScoreBreakdownPanel } from "@/components/home/score-breakdown-panel";
import { PaywallBlock } from "@/components/paywall/paywall-block";
import { PAYWALL_COPY } from "@/lib/paywall-copy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MarketHeatmap = dynamic(
  () => import("@/components/market/market-heatmap").then((m) => ({ default: m.MarketHeatmap })),
  {
    ssr: false,
    loading: () => (
      <div className="b70-dash-skeleton h-[400px] w-full rounded-xl border border-[var(--b70-border)]" />
    ),
  },
);

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Dashboard fetch failed");
  return r.json() as Promise<HomeDashboardPayload>;
};

function SentimentBadge({ sentiment, score }: { sentiment: string; score: number }) {
  const warm =
    sentiment === "bullish"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : sentiment === "bearish"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300";
  return (
    <div className={clsx("rounded-lg border px-3 py-2", warm)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">Market tone</p>
      <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-lg font-semibold capitalize">
        {sentiment}
      </p>
      <p className="text-[11px] opacity-70">
        Score {score > 0 ? "+" : ""}
        {score}
      </p>
    </div>
  );
}

function SectionTitle({ kicker, title, href }: { kicker: string; title: string; href?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          {kicker}
        </p>
        <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[var(--b70-text)]">{title}</h2>
      </div>
      {href ? (
        <Link
          href={href}
          className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
        >
          Open →
        </Link>
      ) : null}
    </div>
  );
}

function MoverTable({
  title,
  rows,
  positive,
}: {
  title: string;
  rows: HomeDashboardPayload["market"]["gainers"];
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-3 shadow-sm transition-all duration-200 hover:border-[var(--b70-crypto-blue)]/25">
      <h3 className="text-xs font-semibold text-[var(--b70-text-muted)]">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {rows.slice(0, 5).map((r) => (
          <li key={r.slug + r.symbol}>
            <Link
              href={`/coins/${r.slug}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--b70-bg)]"
            >
              <span className="truncate text-xs font-medium text-[var(--b70-text)]">
                {r.symbol}{" "}
                <span className="font-normal text-[var(--b70-text-muted)]">{r.name}</span>
              </span>
              <span
                className={clsx(
                  "shrink-0 font-[family-name:var(--font-jetbrains)] text-xs",
                  positive
                    ? r.change24h >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                    : r.change24h >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                )}
              >
                {formatChangePct(r.change24h)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpportunityGridCard({ o }: { o: Opportunity }) {
  const href = o.id < 0 ? "/opportunities" : `/opportunities/${o.slug}`;
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--b70-crypto-blue)]/35 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
          {o.type}
        </span>
        <Block70ScoreBadge totalScore={o.total_score} />
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--b70-text)] group-hover:text-[var(--b70-crypto-blue)]">
        {o.title}
      </p>
      {o.summary ? (
        <p className="mt-1 line-clamp-2 text-xs text-[var(--b70-text-muted)]">{o.summary}</p>
      ) : null}
      <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">Entry / exit thesis on detail page</p>
    </Link>
  );
}

export function IntelligenceDashboard() {
  const { data, error, isLoading, isValidating } = useSWR("/api/home/dashboard", fetcher, {
    refreshInterval: 20_000,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

  const show = data;
  const bestOpp = show?.opportunities[0];

  return (
    <div className="b70-shimmer space-y-10 pb-16 pt-2">
      <header
        className={clsx(
          "flex flex-col gap-3 border-b border-[var(--b70-border)] pb-6 md:flex-row md:items-end md:justify-between",
          isValidating && show && "b70-header-validating",
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="b70-live-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-80" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--b70-text-muted)]">
              Block70 · Trading terminal
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--b70-text)] md:text-3xl">
            Intelligence desk
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--b70-text-muted)]">
            Block70 Score, live signals, narratives, and smart-money flow — one command surface for
            opportunity discovery. Not financial advice.
          </p>
        </div>
        <div className="text-right text-xs text-[var(--b70-text-muted)]">
          <p className="font-[family-name:var(--font-jetbrains)]">
            {show?.meta.generatedAt
              ? `Last updated ${new Date(show.meta.generatedAt).toLocaleString()}`
              : isLoading
                ? "Syncing…"
                : "—"}
          </p>
          <p
            className={clsx(
              "mt-0.5 opacity-80 transition-opacity",
              isValidating && show && "font-medium text-[var(--b70-crypto-blue)] opacity-100",
            )}
          >
            {isValidating && show ? "Refreshing live data…" : `Auto refresh ~${show?.meta.cacheTtlSec ?? 15}s`}
            {error ? " · reconnecting" : ""}
          </p>
        </div>
      </header>

      {!show && isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="b70-dash-skeleton h-28 rounded-xl border border-[var(--b70-border)]" />
          ))}
        </div>
      ) : show ? (
        <>
          <HomeSignalsStrip signals={show.signals} />

          {/* HERO — 3 columns */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--b70-border)] bg-gradient-to-b from-[var(--b70-card-elevated)] to-[var(--b70-card)] p-4 shadow-sm lg:min-h-[320px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-orange)]">
                Best opportunity
              </p>
              {bestOpp ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Block70ScoreBadge totalScore={bestOpp.total_score} />
                    <span className="rounded border border-[var(--b70-border)] px-2 py-0.5 text-[10px] uppercase text-[var(--b70-text-muted)]">
                      {bestOpp.type}
                    </span>
                  </div>
                  <Link
                    href={bestOpp.id < 0 ? "/opportunities" : `/opportunities/${bestOpp.slug}`}
                    className="text-lg font-semibold leading-snug text-[var(--b70-text)] transition-colors hover:text-[var(--b70-crypto-blue)]"
                  >
                    {bestOpp.title}
                  </Link>
                  {bestOpp.summary ? (
                    <p className="line-clamp-2 text-xs text-[var(--b70-text-muted)]">{bestOpp.summary}</p>
                  ) : null}
                  <ScoreBreakdownPanel opportunity={bestOpp} className="mt-auto pt-2" />
                </>
              ) : (
                <p className="text-sm text-[var(--b70-text-muted)]">No ranked opportunities yet.</p>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                Market snapshot
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3">
                  <p className="text-[9px] font-semibold uppercase text-[var(--b70-text-muted)]">Mkt cap</p>
                  <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-base font-semibold text-[var(--b70-text)]">
                    {show.hero.totalMarketCapUsd != null
                      ? formatCompactUsd(show.hero.totalMarketCapUsd)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3">
                  <p className="text-[9px] font-semibold uppercase text-[var(--b70-text-muted)]">24h vol</p>
                  <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-base font-semibold text-[var(--b70-text)]">
                    {show.hero.volume24hUsd != null ? formatCompactUsd(show.hero.volume24hUsd) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3">
                  <p className="text-[9px] font-semibold uppercase text-[var(--b70-text-muted)]">BTC / ETH</p>
                  <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-[var(--b70-text)]">
                    {show.hero.btcDominancePct != null ? `${show.hero.btcDominancePct.toFixed(1)}%` : "—"}{" "}
                    <span className="text-[var(--b70-text-muted)]">/</span>{" "}
                    {show.hero.ethDominancePct != null ? `${show.hero.ethDominancePct.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-2">
                  <SentimentBadge sentiment={show.hero.sentiment} score={show.hero.sentimentScore} />
                </div>
              </div>
              <div className="border-t border-[var(--b70-border)] pt-3">
                <p className="text-[9px] font-semibold uppercase text-[var(--b70-text-muted)]">Narratives</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {show.hero.topNarratives.map((n) => (
                    <Link
                      key={n.name}
                      href="/narratives"
                      className={clsx(
                        "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors hover:border-[var(--b70-crypto-blue)]",
                        n.trend === "bullish" &&
                          "border-emerald-500/45 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                        n.trend === "bearish" &&
                          "border-rose-500/45 bg-rose-500/10 text-rose-800 dark:text-rose-300",
                        n.trend === "neutral" &&
                          "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
                      )}
                    >
                      {n.name}
                    </Link>
                  ))}
                </div>
                {show.hero.insightHeadline ? (
                  <p className="mt-2 text-[11px] text-[var(--b70-text-muted)]">
                    <span className="font-medium text-[var(--b70-text)]">Pulse: </span>
                    {show.hero.insightHeadline}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                  Smart money
                </p>
                <Link href="/smartwallets" className="text-[10px] font-semibold text-[var(--b70-crypto-blue)] hover:underline">
                  Directory →
                </Link>
              </div>
              <ul className="mt-3 flex-1 space-y-2">
                {show.smartMoney.wallets.slice(0, 4).map((w) => (
                  <li
                    key={w.wallet_address}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-[var(--b70-text)]">
                      {w.wallet_address.slice(0, 6)}…{w.wallet_address.slice(-4)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {(w.win_rate * 100).toFixed(0)}%
                    </span>
                    <span className="text-[var(--b70-text-muted)]">
                      {formatCompactUsd(w.total_profit_usd)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-2 border-t border-[var(--b70-border)] pt-3">
                {show.smartMoney.flows.slice(0, 2).map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--b70-border)] px-2 py-1.5 text-[11px]"
                  >
                    <span className="truncate text-[var(--b70-text)]">{f.label}</span>
                    <span
                      className={clsx(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        f.direction === "in"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {f.direction}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                      {f.amountLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* NARRATIVE ENGINE */}
          <section>
            <SectionTitle kicker="01" title="Narrative engine" href="/narratives" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {show.narratives.map((n, idx) => (
                <div
                  key={n.id}
                  className={clsx(
                    "rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    idx === 0 && "md:col-span-2 xl:col-span-2",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--b70-text)]">{n.name}</h3>
                    <span
                      className={clsx(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase",
                        n.trend === "bullish" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        n.trend === "bearish" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                        n.trend === "neutral" && "bg-slate-500/15 text-slate-600 dark:text-slate-300",
                      )}
                    >
                      {n.trend}
                    </span>
                  </div>
                  <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-2xl font-semibold text-[var(--b70-text)] md:text-3xl">
                    {n.sentimentScore > 0 ? "+" : ""}
                    {n.sentimentScore}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">Sentiment score (model)</p>
                  <div
                    className={clsx(
                      "mt-3 h-2 overflow-hidden rounded-full bg-[var(--b70-border)]",
                      idx === 0 && "md:h-2.5",
                    )}
                  >
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all duration-700",
                        n.sentimentScore >= 0 ? "bg-emerald-500/80" : "bg-rose-500/80",
                      )}
                      style={{
                        width: `${Math.min(100, Math.abs(n.sentimentScore) + 20)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-[11px] text-[var(--b70-text-muted)]">
                    Capital flow:{" "}
                    <span
                      className={clsx(
                        "font-medium",
                        n.capitalFlow === "in" && "text-emerald-600 dark:text-emerald-400",
                        n.capitalFlow === "out" && "text-rose-600 dark:text-rose-400",
                        n.capitalFlow === "neutral" && "text-[var(--b70-text)]",
                      )}
                    >
                      {n.capitalFlow}
                    </span>{" "}
                    · vol/mcap {(n.volToMcap * 100).toFixed(1)}¢
                  </p>
                  {n.topSymbols.length ? (
                    <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
                      Leaders: {n.topSymbols.slice(0, 4).join(", ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* OPPORTUNITIES GRID */}
          <section>
            <SectionTitle kicker="02" title="Opportunities" href="/opportunities" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {show.opportunities.slice(0, 6).map((o) => (
                <OpportunityGridCard key={o.id} o={o} />
              ))}
            </div>
            <div className="mt-4">
              <PaywallBlock
                variant="hard"
                urgencyLabel="Full thesis"
                headline={PAYWALL_COPY.headlineDetected}
                checkoutViaModal
                defaultCheckoutPlan="elite"
                primaryCtaLabel={PAYWALL_COPY.ctaUnlockTrade}
                subhead="Unlock full Block70 Score breakdown, entry/exit framing, and Elite filters across the app."
                bullets={[
                  "Factor-level score drivers",
                  "Thesis and liquidity context",
                  "Execution-grade filters on opportunities",
                ]}
                href="/pricing"
              />
            </div>
          </section>

          {/* SMART MONEY (full) */}
          <section>
            <SectionTitle kicker="03" title="Smart wallet activity" href="/smartwallets" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition-all duration-200 hover:border-[var(--b70-crypto-blue)]/20">
                <h3 className="text-xs font-semibold text-[var(--b70-text-muted)]">Leaderboard clip</h3>
                <ul className="mt-3 min-h-[260px] space-y-2">
                  {show.smartMoney.wallets.slice(0, 8).map((w) => (
                    <li
                      key={w.wallet_address}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-[var(--b70-text)]">
                        {w.wallet_address.slice(0, 6)}…{w.wallet_address.slice(-4)}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {(w.win_rate * 100).toFixed(0)}% win
                      </span>
                      <span className="text-[var(--b70-text-muted)]">
                        {formatCompactUsd(w.total_profit_usd)}
                      </span>
                    </li>
                  ))}
                  {Array.from({ length: Math.max(0, 8 - show.smartMoney.wallets.length) }).map((_, i) => (
                    <li
                      key={`leaderboard-pad-${i}`}
                      aria-hidden
                      className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-xs blur-[2.5px] select-none opacity-60"
                    >
                      <span className="font-mono text-[var(--b70-text)]">0x••••••</span>
                      <span className="text-emerald-600/50 dark:text-emerald-400/50">— win</span>
                      <span className="text-[var(--b70-text-muted)]">—</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                {show.smartMoney.flows.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-[var(--b70-text)]">{f.label}</h3>
                      <span
                        className={clsx(
                          "rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
                          f.direction === "in"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {f.direction}
                      </span>
                    </div>
                    <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-lg text-[var(--b70-text)]">
                      {f.amountLabel}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* TRENDING & FLOW */}
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
                  04
                </p>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[var(--b70-text)]">
                  Trending and capital flow
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-medium text-[var(--b70-crypto-blue)]">
                <Link href="/trending" className="hover:underline">
                  Trending →
                </Link>
                <Link href="/capitalflow" className="hover:underline">
                  Capital flow →
                </Link>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <MoverTable title="Top gainers" rows={show.market.gainers} positive />
              <MoverTable title="Top losers" rows={show.market.losers} positive={false} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
              <div className="lg:col-span-2">
                <h3 className="mb-2 text-xs font-semibold text-[var(--b70-text-muted)]">Heatmap</h3>
                <MarketHeatmap coins={show.market.heatmap} maxTiles={10} />
              </div>
              <div className="flex min-h-0 flex-col lg:min-h-[616px]">
                <h3 className="mb-2 text-xs font-semibold text-[var(--b70-text-muted)]">Volume spikes</h3>
                <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-3 lg:min-h-[560px]">
                  <ul className="max-h-[520px] space-y-1 overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
                    {show.market.volumeSpikes.map((v) => (
                      <li key={v.slug}>
                        <Link
                          href={`/coins/${v.slug}`}
                          className="flex flex-col rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-[var(--b70-border)] hover:bg-[var(--b70-bg)]"
                        >
                          <span className="text-xs font-medium text-[var(--b70-text)]">
                            {v.symbol}{" "}
                            <span className="font-normal text-[var(--b70-text-muted)]">
                              vol/mcap {(v.volToMcap * 100).toFixed(1)}¢
                            </span>
                          </span>
                          <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--b70-text-muted)]">
                            {formatCompactUsd(v.volume24h)} · {formatChangePct(v.change24h)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* AI INSIGHTS */}
          <section>
            <SectionTitle kicker="05" title="AI insights" />
            <div className="grid gap-4 md:grid-cols-3">
              <Link
                href="/copilot"
                className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--b70-crypto-blue)]/40 hover:shadow-md"
              >
                <p className="text-[10px] font-semibold uppercase text-[var(--b70-crypto-blue)]">Desk</p>
                <p className="mt-2 text-sm font-semibold text-[var(--b70-text)]">Copilot briefing</p>
                <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                  Portfolio-aware reads, trade ideas, and alert strips.
                </p>
              </Link>
              <Link
                href="/ai-search"
                className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--b70-crypto-blue)]/40 hover:shadow-md"
              >
                <p className="text-[10px] font-semibold uppercase text-[var(--b70-crypto-blue)]">Search</p>
                <p className="mt-2 text-sm font-semibold text-[var(--b70-text)]">Intelligence queries</p>
                <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                  Ask across narratives, flows, and market context.
                </p>
              </Link>
              <Link
                href="/insights"
                className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--b70-crypto-blue)]/40 hover:shadow-md"
              >
                <p className="text-[10px] font-semibold uppercase text-[var(--b70-crypto-blue)]">Library</p>
                <p className="mt-2 text-sm font-semibold text-[var(--b70-text)]">Insights feed</p>
                <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                  Curated research-style notes and opportunity context.
                </p>
              </Link>
            </div>
          </section>

          {/* AIRDROP TEASER */}
          <section>
            <Card className="overflow-hidden border-[var(--b70-border)] bg-gradient-to-r from-[var(--b70-card)] to-[var(--b70-card-elevated)] p-6" hover>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
                    Rewards
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--b70-text)]">Airdrops and programs</h2>
                  <p className="mt-1 max-w-xl text-sm text-[var(--b70-text-muted)]">
                    Discovery hub for incentive programs — verify official links before participating.
                  </p>
                </div>
                <Link href="/airdrops">
                  <Button className="bg-[var(--b70-crypto-blue)] text-white hover:opacity-90">Explore airdrops</Button>
                </Link>
              </div>
            </Card>
          </section>

          {/* NEWS PULSE */}
          <section>
            <SectionTitle kicker="06" title="News pulse" href="/news" />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {show.news.slice(0, 6).map((n) => (
                <li
                  key={n.id}
                  className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition-all duration-200 hover:border-[var(--b70-crypto-blue)]/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase text-[var(--b70-text-muted)]">
                      {n.source}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--b70-crypto-orange)]">
                      Impact {n.narrativeImpact}
                    </span>
                  </div>
                  <a
                    href={n.url}
                    className="mt-2 block text-sm font-semibold text-[var(--b70-text)] hover:underline"
                  >
                    {n.title}
                  </a>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--b70-text-muted)]">
                    {n.aiSummary}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* FINAL CTA */}
          <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--b70-card)] to-[var(--b70-card)] p-8 text-center shadow-lg">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-200/90">Upgrade</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--b70-text)] md:text-2xl">
              {PAYWALL_COPY.subSmartMoney}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--b70-text-muted)]">{PAYWALL_COPY.subUpgrade}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/pricing">
                <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400">{PAYWALL_COPY.ctaElite}</Button>
              </Link>
              <Link href="/store">
                <Button variant="outline">Marketplace</Button>
              </Link>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-700 dark:text-rose-300">
          Unable to load dashboard. Confirm API connectivity and retry.
        </div>
      )}
    </div>
  );
}
