import { getSignalsForToken, getOpportunities, getAIInsightsForToken, API_BASE_URL } from "@/lib/api";
import type { SignalDto } from "@/lib/types";
import { getCoinBySlug } from "@/lib/coins";
import { SignalTimeline } from "@/components/signals/signal-timeline";
import { SignalHeatmap } from "@/components/signals/signal-heatmap";
import { SignalCard } from "@/components/signals/signal-card";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import Link from "next/link";

type PageProps = {
  params: Promise<{ token: string }>;
};

function buildAISummary(
  signals: SignalDto[],
  aiInsights: { title?: string | null; summary?: string | null }[],
  token: string,
): string {
  const count = signals.length;
  const avgConf =
    count > 0
      ? (signals.reduce((s, x) => s + (x.confidence_score ?? 0), 0) / count) * 100
      : 0;
  const types = [...new Set(signals.map((s) => s.signal_type).filter(Boolean))];
  const parts: string[] = [
    `${token} has ${count} signal${count !== 1 ? "s" : ""} with an average confidence of ${avgConf.toFixed(0)}%.`,
  ];
  if (types.length > 0) {
    parts.push(`Signal types: ${types.slice(0, 5).join(", ")}.`);
  }
  const topInsight = aiInsights[0];
  if (topInsight?.summary) {
    parts.push(topInsight.summary.slice(0, 200) + (topInsight.summary.length > 200 ? "…" : ""));
  }
  return parts.join(" ");
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const symbol = token.toUpperCase();
  return {
    title: `${symbol} Signals · Block70 Crypto Signals`,
    description: `Live Block70 signals for ${symbol}: signal timeline, confidence scores, related opportunities, and AI insights.`,
    openGraph: {
      title: `${symbol} Signals · Block70`,
      description: `Block70 signals for ${symbol} — confidence, heatmap, and opportunities.`,
    },
  };
}

export default async function SignalTokenPage({ params }: PageProps) {
  const { token } = await params;
  const symbol = token.toUpperCase();

  let signals: SignalDto[] = [];
  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  let aiInsights: Awaited<ReturnType<typeof getAIInsightsForToken>> = [];
  let coinInfo: Awaited<ReturnType<typeof getCoinBySlug>>["coin"] | null = null;
  let error: string | null = null;

  try {
    const [sigResp, oppResp, insightsResp] = await Promise.all([
      getSignalsForToken(symbol, { limit: 100 }),
      getOpportunities(),
      getAIInsightsForToken(symbol, { limit: 10 }),
    ]);
    signals = sigResp ?? [];
    opportunities = oppResp ?? [];
    aiInsights = insightsResp ?? [];
  } catch {
    error = "Unable to load signals for this token. Please try again shortly.";
  }

  try {
    const data = await getCoinBySlug(token.toLowerCase());
    coinInfo = data.coin;
  } catch {
    // optional: token may not exist in coins table
  }

  const relatedOpportunities = opportunities
    .filter(
      (op) =>
        (op.asset_symbol ?? op.base_symbol)?.toUpperCase() === symbol &&
        op.status === "active",
    )
    .slice(0, 5);

  const avgConfidence =
    signals.length > 0
      ? signals.reduce((s, x) => s + (x.confidence_score ?? 0), 0) / signals.length
      : 0;

  const aiSummary = buildAISummary(signals, aiInsights, symbol);

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Signals · {symbol}</h1>
          <p className="mt-1 text-xs text-slate-400">
            Signal description, token info, related insights, and charts for {symbol}.
          </p>
        </div>
        <Link
          href="/signals"
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
        >
          ← Back to feed
        </Link>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}
        </section>
      ) : null}

      {/* Token info */}
      {coinInfo ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <h2 className="text-sm font-semibold text-slate-50">Token info</h2>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>{coinInfo.name} ({coinInfo.symbol})</span>
            {coinInfo.market_cap != null ? (
              <span>Market cap: ${(coinInfo.market_cap / 1e6).toFixed(1)}M</span>
            ) : null}
            {coinInfo.category ? <span>Category: {coinInfo.category}</span> : null}
            {coinInfo.chain ? <span>Chain: {coinInfo.chain}</span> : null}
          </div>
          {coinInfo.description ? (
            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{coinInfo.description}</p>
          ) : null}
          <Link
            href={`/coins/${coinInfo.slug}`}
            className="mt-2 inline-block text-xs font-medium text-emerald-400 hover:text-emerald-300"
          >
            View full coin page →
          </Link>
        </section>
      ) : null}

      {/* AI summary */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-50">AI summary</h2>
        <p className="mt-2 text-xs text-slate-400">{aiSummary}</p>
      </section>

      {signals.length > 0 ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs">
              <h3 className="text-sm font-semibold text-slate-50">Summary</h3>
              <p className="mt-2 text-slate-400">
                <span className="font-medium text-slate-200">{signals.length}</span> signals
                · avg confidence{" "}
                <span className="font-semibold text-emerald-300">
                  {(avgConfidence * 100).toFixed(0)}%
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs">
              <h3 className="text-sm font-semibold text-slate-50">Quick links</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/radar/${encodeURIComponent(symbol)}`}
                  className="rounded bg-slate-800 px-2 py-1 text-[11px] text-emerald-300 hover:bg-slate-700"
                >
                  Radar view
                </Link>
                {signals[0] ? (
                  <a
                    href={`${API_BASE_URL}/api/v1/signals/share-card/${signals[0].id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    Share card
                  </a>
                ) : null}
                <Link
                  href="/signals/trending"
                  className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                >
                  Trending signals
                </Link>
                <Link
                  href="/signals/leaderboard"
                  className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                >
                  Leaderboard
                </Link>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-50">Signal heatmap</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Intensity across signal types for this token.
            </p>
            <div className="mt-3">
              <SignalHeatmap signals={signals} maxTokens={20} groupBy="signal_type" />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-50">Timeline</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Chronological view with confidence scores.
            </p>
            <div className="mt-3">
              <SignalTimeline signals={signals} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-50">Related AI insights</h3>
            {aiInsights.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No AI insights for this token yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {aiInsights.slice(0, 5).map((i) => (
                  <li
                    key={i.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-200">{i.title ?? "Insight"}</span>
                    {i.summary ? (
                      <p className="mt-1 text-slate-500">{i.summary.slice(0, 150)}…</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-50">Recent signals</h3>
            <div className="mt-3 space-y-2">
              {signals.slice(0, 10).map((sig) => (
                <SignalCard key={sig.id} signal={sig} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-center text-sm text-slate-400">
          No signals have been recorded for {symbol} yet.
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-50">Related opportunities</h3>
        {relatedOpportunities.length === 0 ? (
          <p className="text-xs text-slate-500">
            No active opportunities match this token. They will appear here as the engine
            discovers them.
          </p>
        ) : (
          relatedOpportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              href={`/opportunities/${opp.slug}`}
            />
          ))
        )}
      </section>
    </div>
  );
}
