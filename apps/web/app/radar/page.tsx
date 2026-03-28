import { Suspense } from "react";
import Link from "next/link";
import { RadarOpportunitiesClient } from "@/components/radar/radar-opportunities-client";
import { getAIInsightsLatest, getNarrativesList, getRadarList, getRadarTop } from "@/lib/api";
import type { CoinListItemDto } from "@/lib/coins";
import { getCoinsList } from "@/lib/coins";
import { buildCoinEnrichmentMap, mergeRadarEvents } from "@/lib/radar-opportunity";
import { withTimeout } from "@/lib/with-timeout";

export const revalidate = 60;

function RadarShellFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 rounded-xl bg-[var(--b70-border)]/40" />
      <div className="h-16 rounded-xl bg-[var(--b70-border)]/40" />
      <div className="h-40 rounded-xl bg-[var(--b70-border)]/40" />
    </div>
  );
}

export default async function RadarDashboardPage() {
  const generatedAt = new Date().toISOString();

  const [list, top, coins, narratives, insights] = await Promise.all([
    withTimeout(getRadarList({ hours: 24 }), 8_000, []),
    withTimeout(getRadarTop(), 8_000, []),
    withTimeout(
      getCoinsList({ limit: 300, page: 1 }).catch(() => [] as CoinListItemDto[]),
      6_000,
      [],
    ),
    withTimeout(getNarrativesList({ limit: 24 }), 5_000, []).catch(() => []),
    withTimeout(getAIInsightsLatest(30), 5_000, []).catch(() => []),
  ]);

  const events = mergeRadarEvents(list, top);
  const enrichmentBySymbol = Object.fromEntries(buildCoinEnrichmentMap(coins));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Discovery
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Hidden opportunity radar
        </h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Early-stage signal clusters merged from Block70&apos;s radar engine—volume, liquidity, wallets, and
          attention. Filter honestly: market-cap presets only apply when we can match your symbol to the coin
          directory. Not financial advice.
        </p>
        <p className="text-xs text-[var(--b70-text-muted)]">
          Want the full feed?{" "}
          <Link href="/signals" className="text-[var(--b70-crypto-blue)] hover:underline">
            Signals
          </Link>
        </p>
      </header>

      <Suspense fallback={<RadarShellFallback />}>
        <RadarOpportunitiesClient
          events={events}
          enrichmentBySymbol={enrichmentBySymbol}
          narratives={narratives}
          insights={insights}
          generatedAt={generatedAt}
        />
      </Suspense>
    </div>
  );
}
