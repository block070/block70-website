"use client";

import Link from "next/link";
import type { AISearchResult } from "@/lib/ai-search-api";

type Props = {
  result: AISearchResult;
  className?: string;
};

function confidenceLabel(score: number): string {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

export function AIAnswer({ result, className = "" }: Props) {
  const {
    answer,
    confidence_score,
    related_tokens,
    related_signals,
    related_opportunities,
    related_insights,
    related_radar,
  } = result;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-[var(--b70-border)]/50 px-2 py-0.5 text-xs font-medium text-[var(--b70-text-muted)]">
            Confidence: {confidenceLabel(confidence_score)} ({(confidence_score * 100).toFixed(0)}%)
          </span>
        </div>
        <p className="mt-3 text-sm text-[var(--b70-text)] whitespace-pre-wrap">
          {answer}
        </p>
      </div>

      {related_tokens.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)] mb-2">
            Related tokens
          </h3>
          <div className="flex flex-wrap gap-2">
            {related_tokens.slice(0, 15).map((t) => (
              <Link
                key={t}
                href={`/signals/${encodeURIComponent(t)}`}
                className="rounded-lg bg-crypto-blue/20 px-2.5 py-1 text-xs font-medium text-crypto-blue hover:bg-crypto-blue/30"
              >
                {t}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {related_signals.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)] mb-2">
            Signals
          </h3>
          <ul className="space-y-2">
            {related_signals.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/signals/${encodeURIComponent(s.token_symbol || "")}`}
                  className="block rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-xs hover:bg-[var(--b70-border)]/30"
                >
                  <span className="font-medium text-[var(--b70-text)]">{s.token_symbol}</span>
                  {" · "}{s.signal_type}
                  {s.confidence_score != null ? ` (${(s.confidence_score * 100).toFixed(0)}%)` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/signals" className="mt-2 inline-block text-xs font-medium text-crypto-blue hover:underline">
            View all signals →
          </Link>
        </section>
      ) : null}

      {related_opportunities.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)] mb-2">
            Opportunities
          </h3>
          <ul className="space-y-2">
            {related_opportunities.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link
                  href={o.slug ? `/opportunities/${o.slug}` : `/opportunities`}
                  className="block rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-xs hover:bg-[var(--b70-border)]/30"
                >
                  {o.title ?? o.asset_symbol}
                  {o.total_score != null ? ` · score ${o.total_score.toFixed(0)}` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/opportunities" className="mt-2 inline-block text-xs font-medium text-crypto-blue hover:underline">
            View all opportunities →
          </Link>
        </section>
      ) : null}

      {related_insights.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)] mb-2">
            AI insights
          </h3>
          <ul className="space-y-2">
            {related_insights.slice(0, 3).map((i) => (
              <li key={i.id}>
                <Link
                  href="/insights"
                  className="block rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-xs hover:bg-[var(--b70-border)]/30"
                >
                  {i.title}
                  {i.summary ? ` — ${i.summary.slice(0, 80)}…` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {related_radar.length > 0 ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)] mb-2">
            Radar events
          </h3>
          <ul className="space-y-2">
            {related_radar.slice(0, 5).map((r, i) => (
              <li key={i}>
                <Link
                  href={r.token_symbol ? `/radar/${encodeURIComponent(r.token_symbol)}` : "/radar"}
                  className="block rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-xs hover:bg-[var(--b70-border)]/30"
                >
                  {r.token_symbol} · {r.event_type}
                  {r.severity_score != null ? ` (${(r.severity_score * 100).toFixed(0)}%)` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/radar" className="mt-2 inline-block text-xs font-medium text-crypto-blue hover:underline">
            View radar →
          </Link>
        </section>
      ) : null}
    </div>
  );
}
