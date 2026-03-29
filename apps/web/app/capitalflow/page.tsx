import { cookies } from "next/headers";

import type { CapitalFlowSummaryDto } from "@/lib/api";
import { getCapitalFlowSummary } from "@/lib/api";
import { CapitalFlowDashboardClient } from "@/components/capitalflow/capital-flow-dashboard-client";
import { isPaidBlock70Plan } from "@/lib/plan-tier";
import { withTimeout } from "@/lib/with-timeout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Capital flow · Block70",
  description:
    "Macro-style capital movement: flows by chain, token, and category. Informational—not financial advice.",
};

const EMPTY: CapitalFlowSummaryDto = {
  hours: 24,
  chain_filter: null,
  total_volume: 0,
  dominant_chain: null,
  by_chain: [],
  by_category: [],
  top_destinations: [],
  hot_edges: [],
  recent: [],
};

export default async function CapitalFlowPage() {
  const plan = cookies().get("block70_plan")?.value ?? "free";
  const hasPaidPlan = isPaidBlock70Plan(plan);

  let initial: CapitalFlowSummaryDto | null = null;
  try {
    initial = await withTimeout(
      getCapitalFlowSummary({ hours: 24, subscriberPlan: plan }),
      8_000,
    );
  } catch {
    initial = null;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Macro liquidity
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Capital movement dashboard
        </h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Track how notional volume moves between assets, chains, and sectors. Pulls from the Block70
          capital-flow ledger; refreshes periodically for a live desk feel. For labeled institution-grade
          analytics, consider dedicated on-chain intelligence platforms—this is a portfolio tracker lens.
        </p>
      </header>

      <CapitalFlowDashboardClient
        initialSummary={initial ?? EMPTY}
        defaultHours={24}
        hasPaidPlan={hasPaidPlan}
      />
    </div>
  );
}
