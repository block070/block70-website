"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { CoinIntelPayload } from "@/lib/ai-intelligence-api";
import { formatChangePct } from "@/lib/format";

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/80", className)}>
      <h2 className="border-b border-[var(--b70-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--b70-muted)]">
        {title}
      </h2>
      <div className="p-4 text-sm text-[var(--b70-fg)]">{children}</div>
    </section>
  );
}

function RelatedCard({ row }: { row: Record<string, unknown> }) {
  const sym = String(row.asset_symbol ?? "");
  const score = row.score != null ? Math.round(Number(row.score)) : null;
  return (
    <Link
      href={`/ai-search?q=${encodeURIComponent(sym)}`}
      className="block rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)]/50 px-3 py-2 transition-colors hover:border-[var(--b70-crypto-blue)]/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{sym}</span>
        {score != null ? <span className="text-xs tabular-nums text-[var(--b70-muted)]">{score}</span> : null}
      </div>
      {row.cycle_stage ? (
        <span className="text-[10px] uppercase tracking-wide text-[var(--b70-muted)]">
          {String(row.cycle_stage)}
        </span>
      ) : null}
    </Link>
  );
}

export function CoinIntelligenceTerminal({ data }: { data: CoinIntelPayload }) {
  const { hero_call, positioning_insight, risk_context, entry_context, prediction, signals, news_insight, headlines, related, coin_page, relative_strength, narrative_flow } = data;

  return (
    <div className="space-y-5">
      <div className="rounded-b70-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 via-[var(--b70-card)] to-[var(--b70-bg)] p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600/90 dark:text-emerald-400/90">
          Coin intelligence
        </p>
        <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-[var(--b70-fg)] md:text-2xl">
          {hero_call.headline}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2.5 py-0.5 text-xs font-medium">
            {hero_call.direction_label}
          </span>
          <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2.5 py-0.5 text-xs text-[var(--b70-muted)]">
            {hero_call.timeframe_label}
          </span>
          <span
            className={clsx(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium",
              hero_call.confidence_tier === "High" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
              hero_call.confidence_tier === "Medium" && "border-amber-500/40 text-amber-700 dark:text-amber-400",
              hero_call.confidence_tier === "Low" && "border-slate-500/40 text-[var(--b70-muted)]",
            )}
          >
            {hero_call.confidence_tier} confidence
          </span>
        </div>
        <p className="mt-3 text-[11px] text-[var(--b70-muted)]">
          Signal interpretation — not financial advice.
        </p>
      </div>

      <div className="rounded-b70-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/90 p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
          Positioning insight
        </h3>
        {positioning_insight.lines.map((line, i) => (
          <p key={i} className="mt-1.5 text-sm font-medium text-[var(--b70-fg)]">
            {line}
          </p>
        ))}
        <div className="mt-4 space-y-2 border-t border-[var(--b70-border)] pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600/90 dark:text-rose-400/90">
              Risk context
            </p>
            {risk_context.lines.map((line, i) => (
              <p key={i} className="mt-0.5 text-sm text-[var(--b70-muted)]">
                {line}
              </p>
            ))}
          </div>
          {entry_context ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-muted)]">
                Entry context · {entry_context.label}
              </p>
              <p className="mt-0.5 text-sm text-[var(--b70-fg)]">{entry_context.explanation}</p>
            </div>
          ) : null}
        </div>
      </div>

      <Section title="Key signals">
        <p className="font-medium text-[var(--b70-fg)]">{signals.primary_driver}</p>
        {signals.supporting.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-[var(--b70-muted)]">
            {signals.supporting.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--b70-muted)]">
          <span>vs BTC {formatChangePct(relative_strength.vs_btc_pct)}</span>
          <span>vs ETH {formatChangePct(relative_strength.vs_eth_pct)}</span>
        </div>
        <p className="mt-2 text-[11px] text-[var(--b70-muted)]">
          RS score {Math.round(relative_strength.score)}/100 (cross-sectional benchmark)
        </p>
        {narrative_flow.length > 0 ? (
          <ul className="mt-2 text-xs text-[var(--b70-muted)]">
            {narrative_flow.map((n) => (
              <li key={n.narrative_id}>
                {n.narrative_id}
                {n.phase ? ` · ${n.phase.replace(/_/g, " ")}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="Structured prediction">
        <ul className="space-y-1.5 text-sm">
          <li>
            <span className="text-[var(--b70-muted)]">Direction:</span>{" "}
            <strong className="text-[var(--b70-fg)]">{prediction.direction}</strong>
          </li>
          <li>
            <span className="text-[var(--b70-muted)]">Horizon:</span>{" "}
            <strong className="text-[var(--b70-fg)]">
              {prediction.horizon} ({prediction.horizon_display})
            </strong>
          </li>
          <li>
            <span className="text-[var(--b70-muted)]">Strength:</span>{" "}
            <strong className="text-[var(--b70-fg)]">{prediction.strength}</strong>
          </li>
        </ul>
      </Section>

      <Section title="News insight">
        {news_insight.lines.map((line, i) => (
          <p key={i} className={clsx(i > 0 && "mt-1")}>
            {line}
          </p>
        ))}
        {news_insight.headline_count != null ? (
          <p className="mt-2 text-xs text-[var(--b70-muted)]">
            {news_insight.headline_count} tagged headline(s) (24h window) · blended sentiment{" "}
            {news_insight.sentiment_score != null ? `~${Math.round(news_insight.sentiment_score)}/100` : "n/a"}
          </p>
        ) : null}
        {headlines.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-[var(--b70-border)] pt-3">
            {headlines.map((h) => (
              <li key={h.url} className="text-xs">
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--b70-crypto-blue)] hover:underline"
                >
                  {h.title}
                </a>
                <span className="text-[var(--b70-muted)]"> — {h.source}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Same narrative leaders">
          <div className="space-y-2">
            {related.narrative_leaders.length === 0 ? (
              <p className="text-xs text-[var(--b70-muted)]">No additional leaders in this snapshot.</p>
            ) : (
              related.narrative_leaders.map((r) => <RelatedCard key={String(r.asset_symbol)} row={r} />)
            )}
          </div>
        </Section>
        <Section title="Earlier stage alternatives">
          <div className="space-y-2">
            {related.earlier_stage.length === 0 ? (
              <p className="text-xs text-[var(--b70-muted)]">No early-stage peers surfaced.</p>
            ) : (
              related.earlier_stage.map((r) => <RelatedCard key={String(r.asset_symbol)} row={r} />)
            )}
          </div>
        </Section>
      </div>

      {coin_page.href ? (
        <div className="flex justify-end">
          <Link
            href={coin_page.href}
            className="text-sm font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            View full coin page →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
