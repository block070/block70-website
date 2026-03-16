"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import {
  getCopilotInsights,
  getCopilotPortfolio,
  getCopilotOpportunities,
  generateCopilotInsights,
  type CopilotInsightDto,
  type CopilotPortfolioDto,
  type CopilotOpportunityDto,
} from "@/lib/copilot-api";
import { CopilotAlert } from "@/components/copilot/copilot-alert";

export default function CopilotPage() {
  const [insights, setInsights] = useState<CopilotInsightDto[]>([]);
  const [portfolio, setPortfolio] = useState<CopilotPortfolioDto | null>(null);
  const [opportunities, setOpportunities] = useState<CopilotOpportunityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuth = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    if (!isAuth) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const [ins, port, opp] = await Promise.all([
          getCopilotInsights({ limit: 30 }),
          getCopilotPortfolio(),
          getCopilotOpportunities({ limit: 15 }),
        ]);
        if (!cancelled) {
          setInsights(ins);
          setPortfolio(port);
          setOpportunities(opp);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load Copilot data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuth]);

  async function handleGenerate() {
    if (!isAuth) return;
    setGenerating(true);
    setError(null);
    try {
      const generated = await generateCopilotInsights({ max_insights: 25, min_confidence: 0.35 });
      setInsights((prev) => [...generated, ...prev]);
      const [port, opp] = await Promise.all([getCopilotPortfolio(), getCopilotOpportunities({ limit: 15 })]);
      setPortfolio(port);
      setOpportunities(opp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate insights");
    } finally {
      setGenerating(false);
    }
  }

  const portfolioAlerts = insights.filter((i) => i.insight_type === "portfolio_alert");
  const marketAlerts = insights.filter((i) => i.insight_type === "market_alert");
  const opportunityAlerts = insights.filter((i) => i.insight_type === "opportunity_alert");
  const narrativeAlerts = insights.filter((i) => i.insight_type === "narrative_alert");

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
            AI Copilot
          </h1>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Get personalized insights on your portfolio, market alerts, and opportunities. Log in to use the Copilot.
          </p>
        </section>
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 text-center">
          <p className="text-sm text-[var(--b70-text-muted)]">Sign in to see your AI Copilot dashboard.</p>
          <Link
            href="/login"
            className="mt-4 inline-block rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
            AI Copilot
          </h1>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Portfolio insights, market alerts, opportunities, and narratives.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/copilot/feed"
            className="rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
          >
            Feed
          </Link>
          <Link
            href="/copilot/chat"
            className="rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
          >
            Chat
          </Link>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-lg bg-crypto-blue px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate insights"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--b70-text-muted)]">Loading Copilot data…</p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--b70-text)]">Portfolio insights</h2>
            {portfolio && (portfolio.risk_concentrations.length > 0 || portfolio.whale_overlaps.length > 0) ? (
              <ul className="space-y-2 text-sm">
                {portfolio.risk_concentrations.map((r) => (
                  <li key={r.token_symbol} className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2">
                    <span className="font-medium">{r.token_symbol}</span>: {r.allocation_pct.toFixed(1)}% allocation — {r.risk_level} risk
                  </li>
                ))}
                {portfolio.whale_overlaps.map((w, i) => (
                  <li key={`${w.token_symbol}-${i}`} className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2">
                    <span className="font-medium">{w.token_symbol}</span>: {w.description}
                  </li>
                ))}
              </ul>
            ) : portfolio?.portfolio_tokens.length ? (
              <p className="text-xs text-[var(--b70-text-muted)]">No concentration or whale overlap alerts. Portfolio has {portfolio.portfolio_tokens.length} token(s).</p>
            ) : (
              <p className="text-xs text-[var(--b70-text-muted)]">Add wallets to your portfolio to get personalized alerts.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--b70-text)]">Portfolio alerts</h2>
            {portfolioAlerts.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {portfolioAlerts.slice(0, 6).map((i) => (
                  <CopilotAlert key={i.id} insight={i} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--b70-text-muted)]">No portfolio alerts. Click “Generate insights” to refresh.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--b70-text)]">Market alerts</h2>
            {marketAlerts.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {marketAlerts.slice(0, 4).map((i) => (
                  <CopilotAlert key={i.id} insight={i} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--b70-text-muted)]">No market alerts right now.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--b70-text)]">Opportunities</h2>
            {(opportunityAlerts.length > 0 || opportunities.length > 0) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {opportunityAlerts.slice(0, 4).map((i) => (
                  <CopilotAlert key={i.id} insight={i} />
                ))}
                {opportunityAlerts.length < 4 && opportunities.slice(0, 4 - opportunityAlerts.length).map((o, i) => (
                  <div key={`opp-${i}`} className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
                    <h3 className="text-sm font-semibold text-[var(--b70-text)]">{o.title}</h3>
                    <p className="mt-1 text-xs text-[var(--b70-text-muted)]">{o.summary}</p>
                    <span className="mt-2 inline-block rounded-full bg-[var(--b70-border)]/50 px-2 py-0.5 text-xs">{(o.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--b70-text-muted)]">No opportunities detected. Generate insights or check back later.</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--b70-text)]">Narratives</h2>
            {narrativeAlerts.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {narrativeAlerts.slice(0, 4).map((i) => (
                  <CopilotAlert key={i.id} insight={i} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--b70-text-muted)]">No narrative alerts. Generate insights to see narrative momentum.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
