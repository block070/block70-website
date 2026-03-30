"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCurrentUser, getToken } from "@/lib/auth";
import {
  getCopilotInsights,
  getCopilotPortfolio,
  getCopilotOpportunities,
  generateCopilotInsights,
  type CopilotInsightDto,
  type CopilotPortfolioDto,
  type CopilotOpportunityDto,
} from "@/lib/copilot-api";
import { listTokenWatchesForUser, type TokenWatchDto } from "@/lib/token-watch-api";
import { CopilotDailyBriefing } from "@/components/copilot/copilot-daily-briefing";
import { CopilotTradeIdeaCard } from "@/components/copilot/copilot-trade-idea-card";
import { CopilotPersonalizationPanel } from "@/components/copilot/copilot-personalization-panel";
import { CopilotAlertsStrip } from "@/components/copilot/copilot-alerts-strip";
import { PaywallSection } from "@/components/paywall/paywall-section";
import { LayoutTemplate, MessageSquare, Newspaper, RefreshCw, Rss } from "lucide-react";

function isWhaleInsight(i: CopilotInsightDto): boolean {
  const blob = `${i.title} ${i.summary ?? ""}`.toLowerCase();
  return (
    i.insight_type === "portfolio_alert" &&
    (blob.includes("whale") || blob.includes("smart money"))
  );
}

export default function CopilotPage() {
  const [insights, setInsights] = useState<CopilotInsightDto[]>([]);
  const [portfolio, setPortfolio] = useState<CopilotPortfolioDto | null>(null);
  const [opportunities, setOpportunities] = useState<CopilotOpportunityDto[]>([]);
  const [watches, setWatches] = useState<TokenWatchDto[]>([]);
  const [watchesError, setWatchesError] = useState<string | null>(null);
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
    setWatchesError(null);
    (async () => {
      try {
        const user = await getCurrentUser();
        const [ins, port, opp, watch] = await Promise.all([
          getCopilotInsights({ limit: 40 }),
          getCopilotPortfolio(),
          getCopilotOpportunities({ limit: 20 }),
          listTokenWatchesForUser(user.id).catch(() => {
            if (!cancelled) setWatchesError("Could not load token watches.");
            return [] as TokenWatchDto[];
          }),
        ]);
        if (!cancelled) {
          setInsights(ins);
          setPortfolio(port);
          setOpportunities(opp);
          setWatches(watch);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load assistant data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuth]);

  const marketAlerts = useMemo(
    () => insights.filter((i) => i.insight_type === "market_alert"),
    [insights],
  );
  const narrativeAlerts = useMemo(
    () => insights.filter((i) => i.insight_type === "narrative_alert"),
    [insights],
  );
  const opportunityAlerts = useMemo(
    () => insights.filter((i) => i.insight_type === "opportunity_alert"),
    [insights],
  );
  const whaleAlerts = useMemo(() => insights.filter(isWhaleInsight), [insights]);

  const tradeIdeaInsights = useMemo(() => {
    const symbols = new Set(opportunities.map((o) => o.token_symbol.toUpperCase()));
    return opportunityAlerts.filter((i) => {
      const t = i.related_tokens?.[0]?.toUpperCase();
      return t && !symbols.has(t);
    });
  }, [opportunities, opportunityAlerts]);

  async function handleGenerate() {
    if (!isAuth) return;
    setGenerating(true);
    setError(null);
    setWatchesError(null);
    try {
      const user = await getCurrentUser();
      const generated = await generateCopilotInsights({ max_insights: 25, min_confidence: 0.35 });
      setInsights((prev) => [...generated, ...prev]);
      const [port, opp, watch] = await Promise.all([
        getCopilotPortfolio(),
        getCopilotOpportunities({ limit: 20 }),
        listTokenWatchesForUser(user.id).catch(() => {
          setWatchesError("Could not load token watches.");
          return [] as TokenWatchDto[];
        }),
      ]);
      setPortfolio(port);
      setOpportunities(opp);
      setWatches(watch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate insights");
    } finally {
      setGenerating(false);
    }
  }

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <section>
          <div className="flex items-center gap-2 text-xs font-medium text-crypto-blue">
            <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
            AI assistant
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
            Crypto desk
          </h1>
          <p className="mt-2 text-sm text-[var(--b70-text-muted)]">
            Daily briefing, trade ideas with risk framing, portfolio context, and alerts. Sign in to
            run your personalized assistant.
          </p>
        </section>
        <div className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-8 text-center shadow-b70-card">
          <p className="text-sm text-[var(--b70-text-muted)]">
            Log in to connect your book, watches, and AI-generated insight stream.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PaywallSection
      feature="ai_full"
      title="Unlock Copilot desk"
      subtitle="Upgrade to Pro or higher for AI briefing, trade ideas, portfolio context, and alerts. Trial Elite access counts toward this unlock."
    >
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-crypto-blue">
            <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
            AI crypto assistant
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--b70-text)] sm:text-3xl">
            Desk
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--b70-text-muted)]">
            Hedge-fund-style read: briefing, ideas with entry and exit framing, your book, and live
            alerts. Not financial advice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/copilot/feed"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
          >
            <Rss className="h-3.5 w-3.5" aria-hidden />
            Feed
          </Link>
          <Link
            href="/copilot/chat"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            Chat
          </Link>
          <Link
            href="/ai-search"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
          >
            <Newspaper className="h-3.5 w-3.5" aria-hidden />
            Intelligence
          </Link>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-crypto-blue px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} aria-hidden />
            {generating ? "Refreshing…" : "Refresh desk"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--b70-text-muted)]">Loading desk…</p>
      ) : (
        <>
          <CopilotDailyBriefing
            portfolio={portfolio}
            marketAlerts={marketAlerts}
            narrativeAlerts={narrativeAlerts}
            opportunities={opportunities}
          />

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--b70-text)]">Trade ideas</h2>
              <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
                Ranked opportunities with confidence, risk label, and qualitative entry and exit
                prompts.
              </p>
            </div>
            {opportunities.length === 0 && tradeIdeaInsights.length === 0 ? (
              <p className="text-sm text-[var(--b70-text-muted)]">
                No ideas in the queue—click Refresh desk after data and signals are available.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {opportunities.slice(0, 8).map((o, idx) => (
                  <CopilotTradeIdeaCard key={`${o.token_symbol}-${o.source}-${idx}`} variant="opportunity" item={o} />
                ))}
                {tradeIdeaInsights.slice(0, 4).map((i) => (
                  <CopilotTradeIdeaCard key={i.id} variant="insight" item={i} />
                ))}
              </div>
            )}
          </section>

          <CopilotPersonalizationPanel
            portfolio={portfolio}
            watches={watches}
            watchesError={watchesError}
          />

          <CopilotAlertsStrip narrativeAlerts={narrativeAlerts} whaleAlerts={whaleAlerts} />
        </>
      )}
      </div>
    </PaywallSection>
  );
}
