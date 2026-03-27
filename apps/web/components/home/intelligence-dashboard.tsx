"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import useSWR from "swr";
import { clsx } from "clsx";
import { formatChangePct, formatCompactUsd } from "@/lib/format";
import type { HomeDashboardPayload } from "@/lib/home/build-home-dashboard";

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
      <p className="text-[11px] opacity-70">Score {score > 0 ? "+" : ""}{score}</p>
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
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-3 shadow-sm">
      <h3 className="text-xs font-semibold text-[var(--b70-text-muted)]">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {rows.slice(0, 8).map((r) => (
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

export function IntelligenceDashboard() {
  const { data, error, isLoading, isValidating } = useSWR("/api/home/dashboard", fetcher, {
    refreshInterval: 20_000,
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

  const show = data;

  return (
    <div className="b70-shimmer space-y-10 pb-16 pt-2">
      <header className="flex flex-col gap-3 border-b border-[var(--b70-border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="b70-live-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-80" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--b70-text-muted)]">
              Block70 · Intelligence
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--b70-text)] md:text-3xl">
            Command center
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--b70-text-muted)]">
            What is happening, what matters, and what to watch — aggregated in one pulse.
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
          <p className="mt-0.5 opacity-80">
            {isValidating ? "Refreshing…" : `Cache ~${show?.meta.cacheTtlSec ?? 15}s`}
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
          {/* HERO */}
          <section className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card-elevated)] p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                    Total market cap
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-xl font-semibold text-[var(--b70-text)]">
                    {show.hero.totalMarketCapUsd != null
                      ? formatCompactUsd(show.hero.totalMarketCapUsd)
                      : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">Global crypto aggregate</p>
                </div>
                <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card-elevated)] p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                    24h volume
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-xl font-semibold text-[var(--b70-text)]">
                    {show.hero.volume24hUsd != null ? formatCompactUsd(show.hero.volume24hUsd) : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">Reported throughput</p>
                </div>
                <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card-elevated)] p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                    BTC / ETH dominance
                  </p>
                  <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-lg font-semibold text-[var(--b70-text)]">
                    {show.hero.btcDominancePct != null ? `${show.hero.btcDominancePct.toFixed(1)}%` : "—"}{" "}
                    <span className="text-[var(--b70-text-muted)]">/</span>{" "}
                    {show.hero.ethDominancePct != null ? `${show.hero.ethDominancePct.toFixed(1)}%` : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">Share of total cap</p>
                </div>
                <SentimentBadge sentiment={show.hero.sentiment} score={show.hero.sentimentScore} />
              </div>
              <div className="mt-4 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                  Top narratives
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {show.hero.topNarratives.map((n) => (
                    <Link
                      key={n.name}
                      href="/narratives"
                      className="group inline-flex items-center gap-2 rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-1.5 text-xs font-medium transition-colors hover:border-[var(--b70-crypto-blue)]"
                    >
                      <span className="text-[var(--b70-text)]">{n.name}</span>
                      <span
                        className={clsx(
                          "rounded px-1.5 py-0.5 text-[10px] uppercase",
                          n.trend === "bullish" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                          n.trend === "bearish" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                          n.trend === "neutral" && "bg-slate-500/15 text-slate-600 dark:text-slate-300",
                        )}
                      >
                        {n.trend}
                      </span>
                      <span className="text-[10px] text-[var(--b70-text-muted)]">flow {n.capitalFlow}</span>
                    </Link>
                  ))}
                </div>
                {show.hero.insightHeadline ? (
                  <p className="mt-3 border-t border-[var(--b70-border)] pt-3 text-sm text-[var(--b70-text-muted)]">
                    <span className="font-medium text-[var(--b70-text)]">Insight: </span>
                    {show.hero.insightHeadline}
                  </p>
                ) : null}
              </div>
            </div>
            <aside className="lg:col-span-4">
              <div className="flex h-full flex-col rounded-xl border border-[var(--b70-border)] bg-gradient-to-b from-[var(--b70-card-elevated)] to-[var(--b70-card)] p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                  What to watch
                </p>
                <ul className="mt-4 flex-1 space-y-3 text-sm">
                  <li className="flex gap-2">
                    <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-crypto-orange)]">
                      01
                    </span>
                    <span className="text-[var(--b70-text)]">
                      Dominance shift if majors grab share from alts during stress.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-crypto-orange)]">
                      02
                    </span>
                    <span className="text-[var(--b70-text)]">
                      Narrative velocity vs. funding — divergences often mean reversal risk.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-crypto-orange)]">
                      03
                    </span>
                    <span className="text-[var(--b70-text)]">
                      Whale leaderboard drift — conviction pockets before retail notices.
                    </span>
                  </li>
                </ul>
                <Link
                  href="/radar"
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] py-2 text-xs font-semibold text-[var(--b70-text)] transition-colors hover:border-[var(--b70-crypto-blue)]"
                >
                  Open radar
                </Link>
              </div>
            </aside>
          </section>

          {/* MARKET SNAPSHOT */}
          <section>
            <SectionTitle kicker="01" title="Market snapshot" href="/trending" />
            <div className="grid gap-4 lg:grid-cols-2">
              <MoverTable title="Top gainers" rows={show.market.gainers} positive />
              <MoverTable title="Top losers" rows={show.market.losers} positive={false} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <h3 className="mb-2 text-xs font-semibold text-[var(--b70-text-muted)]">Heatmap</h3>
                <MarketHeatmap coins={show.market.heatmap} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold text-[var(--b70-text-muted)]">Volume spikes</h3>
                <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-3">
                  <ul className="space-y-2">
                    {show.market.volumeSpikes.map((v) => (
                      <li key={v.slug}>
                        <Link
                          href={`/coins/${v.slug}`}
                          className="flex flex-col rounded-lg border border-transparent px-2 py-1.5 hover:border-[var(--b70-border)] hover:bg-[var(--b70-bg)]"
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

          {/* NARRATIVE ENGINE */}
          <section>
            <SectionTitle kicker="02" title="Narrative engine" href="/narratives" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {show.narratives.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition-transform hover:-translate-y-0.5 hover:shadow-md"
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
                  <p className="mt-2 font-[family-name:var(--font-jetbrains)] text-2xl font-semibold text-[var(--b70-text)]">
                    {n.sentimentScore > 0 ? "+" : ""}
                    {n.sentimentScore}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">Sentiment score (model)</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--b70-border)]">
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
                    <span className="font-medium text-[var(--b70-text)]">{n.capitalFlow}</span> · vol/mcap{" "}
                    {(n.volToMcap * 100).toFixed(1)}¢
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

          {/* SMART MONEY */}
          <section>
            <SectionTitle kicker="03" title="Smart money" href="/wallets/smart-money" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
                <h3 className="text-xs font-semibold text-[var(--b70-text-muted)]">Leaderboard clip</h3>
                <ul className="mt-3 space-y-2">
                  {show.smartMoney.wallets.slice(0, 6).map((w) => (
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
                </ul>
              </div>
              <div className="space-y-3">
                {show.smartMoney.flows.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4"
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

          {/* SIGNALS */}
          <section>
            <SectionTitle kicker="04" title="Signals" href="/signals" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {show.signals.map((s) => (
                <Link
                  key={s.id}
                  href={s.token_symbol ? `/signals/${encodeURIComponent(s.token_symbol)}` : "/signals"}
                  className="block rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition-colors hover:border-[var(--b70-crypto-blue)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
                      {s.signal_type}
                    </span>
                    <span className="font-[family-name:var(--font-jetbrains)] text-xs text-[var(--b70-crypto-blue)]">
                      {s.confidence_score.toFixed(0)}% conf
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--b70-text)]">
                    {s.title || s.token_symbol || "Signal"}
                  </p>
                  {s.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--b70-text-muted)]">{s.description}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>

          {/* NEWS + OPPORTUNITIES */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <SectionTitle kicker="05" title="News intelligence" href="/news" />
              <ul className="space-y-3">
                {show.news.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase text-[var(--b70-text-muted)]">
                        {n.source}
                      </span>
                      <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--b70-crypto-orange)]">
                        Impact {n.narrativeImpact}
                      </span>
                    </div>
                    <a href={n.url} className="mt-2 block text-sm font-semibold text-[var(--b70-text)] hover:underline">
                      {n.title}
                    </a>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--b70-text-muted)]">{n.aiSummary}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionTitle kicker="06" title="High-conviction opportunities" href="/opportunities" />
              <ul className="space-y-3">
                {show.opportunities.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={o.id < 0 ? "/opportunities" : `/opportunities/${o.slug}`}
                      className="block rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 transition-colors hover:border-[var(--b70-crypto-blue)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase text-[var(--b70-text-muted)]">
                          {o.type}
                        </span>
                        <span className="font-[family-name:var(--font-jetbrains)] text-xs text-emerald-600 dark:text-emerald-400">
                          score {(o.total_score ?? 0).toFixed(0)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[var(--b70-text)]">{o.title}</p>
                      {o.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--b70-text-muted)]">{o.summary}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
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
