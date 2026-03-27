"use client";

import { Calendar, Radio, Sparkles, TrendingUp } from "lucide-react";
import type { CopilotInsightDto, CopilotOpportunityDto, CopilotPortfolioDto } from "@/lib/copilot-api";

type Props = {
  portfolio: CopilotPortfolioDto | null;
  marketAlerts: CopilotInsightDto[];
  narrativeAlerts: CopilotInsightDto[];
  opportunities: CopilotOpportunityDto[];
};

function briefLine(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

export function CopilotDailyBriefing({
  portfolio,
  marketAlerts,
  narrativeAlerts,
  opportunities,
}: Props) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const marketLead =
    briefLine(marketAlerts[0]?.summary) ??
    briefLine(marketAlerts[0]?.title) ??
    "No live market headline in your feed—refresh the desk to pull context from signals and flows.";

  const narrativeLines = narrativeAlerts
    .slice(0, 3)
    .map((n) => briefLine(n.summary) ?? n.title)
    .filter(Boolean) as string[];

  const oppLines = opportunities
    .slice(0, 3)
    .map((o) => `${o.token_symbol}: ${briefLine(o.summary) ?? o.title}`);

  const bookLine =
    portfolio && portfolio.portfolio_tokens.length > 0
      ? `Book: ${portfolio.portfolio_tokens.length} name(s) • ${
          portfolio.total_value_usd >= 1e6
            ? `$${(portfolio.total_value_usd / 1e6).toFixed(2)}M`
            : portfolio.total_value_usd >= 1e3
              ? `$${(portfolio.total_value_usd / 1e3).toFixed(1)}K`
              : `$${portfolio.total_value_usd.toFixed(0)}`
        } notional (model).`
      : "Connect your portfolio to personalize risk and overlap in this briefing.";

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-gradient-to-br from-[var(--b70-card)] via-[var(--b70-card)] to-crypto-blue/5 shadow-b70-card">
      <div className="border-b border-[var(--b70-border)]/80 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-crypto-blue">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Daily briefing
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[var(--b70-text)]">
          <h2 className="text-lg font-semibold tracking-tight">Desk snapshot</h2>
          <span className="flex items-center gap-1 text-xs font-normal text-[var(--b70-text-muted)]">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {dateLabel}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--b70-text-muted)]">{bookLine}</p>
      </div>

      <div className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-[var(--b70-border)]/80">
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            <TrendingUp className="h-3.5 w-3.5 text-crypto-blue" aria-hidden />
            Market
          </div>
          <p className="text-sm leading-relaxed text-[var(--b70-text)]">{marketLead}</p>
        </div>
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            <Radio className="h-3.5 w-3.5 text-crypto-blue" aria-hidden />
            Narratives
          </div>
          {narrativeLines.length ? (
            <ul className="list-inside list-disc space-y-1.5 text-sm text-[var(--b70-text)]">
              {narrativeLines.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--b70-text-muted)]">
              No narrative clips yet—run a desk refresh to sync theme momentum.
            </p>
          )}
        </div>
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-crypto-blue" aria-hidden />
            Opportunities
          </div>
          {oppLines.length ? (
            <ul className="list-inside list-disc space-y-1.5 text-sm text-[var(--b70-text)]">
              {oppLines.map((line, i) => (
                <li key={i} className="leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--b70-text-muted)]">
              No ranked opportunities—generate insights after connecting data sources.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
