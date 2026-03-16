import { getOpportunities } from "@/lib/api";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardSummaryCards } from "@/components/dashboard/summary-cards";
import { OpportunityFeed } from "@/components/dashboard/opportunity-feed";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { AlphaFeed } from "@/components/dashboard/alpha-feed";
import { AlphaOfTheHour } from "@/components/dashboard/alpha-of-the-hour";
import { LiquidityPanel } from "@/components/dashboard/liquidity-panel";
import { SignalFeedPanel } from "@/components/dashboard/signal-feed-panel";

export default async function DashboardPage() {
  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];
  let backendError: string | null = null;

  try {
    const data = await getOpportunities();
    opportunities = data.sort((a, b) => b.total_score - a.total_score);
  } catch (error) {
    backendError =
      "Unable to reach the Block70 backend right now. Your alpha will be back shortly.";
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-50">
          My Dashboard
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Drag to move, resize corners to size. Layout is saved when you’re logged in.
        </p>
        <DashboardView />
      </section>

      <section>
        <AlphaOfTheHour />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-50">
          Opportunity Overview
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Live view of normalized opportunities across arbitrage, miner ROI, and
          smart wallets.
        </p>
      </section>

      <section>
        <DashboardSummaryCards opportunities={opportunities} />
      </section>

      <section>
        <InsightsPanel initialOpportunities={opportunities} />
      </section>

      {backendError ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {backendError}
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-100">
          Latest Opportunities
        </h3>
        <OpportunityFeed
          opportunities={opportunities}
          isLoading={!backendError && opportunities.length === 0}
        />
      </section>

      <section>
        <AlphaFeed />
      </section>

      <section>
        <LiquidityPanel />
      </section>

      <section>
        <SignalFeedPanel />
      </section>
    </div>
  );
}

