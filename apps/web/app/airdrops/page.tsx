import type { Opportunity } from "@/lib/types";
import { getAirdropsForServer } from "@/lib/get-airdrops-server";
import { withTimeout } from "@/lib/with-timeout";

import { AirdropsDiscoveryClient } from "@/components/airdrops/airdrops-discovery-client";

/** Required with headers() + dynamic data fetch in this tree. */
export const dynamic = "force-dynamic";

export default async function AirdropsPage() {
  let opportunities: Opportunity[] = [];
  let backendError: string | null = null;

  try {
    const data = await withTimeout(getAirdropsForServer(), 8_000);
    opportunities = data.sort((a, b) => b.total_score - a.total_score);
  } catch {
    backendError =
      "Unable to load airdrop opportunities from the backend right now.";
  }

  const active = opportunities.filter((o) => o.status === "active").length;
  const upcoming = opportunities.filter((o) => o.status === "upcoming").length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Rewards discovery
        </h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Curated airdrop and incentive listings from vetted pipeline sources — estimates only,
          not financial advice. Use presets to explore by value, effort, or recency.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
            Active
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
            {backendError ? "—" : active}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
            Upcoming
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
            {backendError ? "—" : upcoming}
          </p>
        </div>
      </section>

      <AirdropsDiscoveryClient
        initialOpportunities={opportunities}
        backendError={backendError}
      />
    </div>
  );
}
