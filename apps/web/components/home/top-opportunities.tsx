import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";

type TopOpportunitiesProps = {
  opportunities: Opportunity[];
  errorMessage?: string | null;
};

export function TopOpportunities({
  opportunities,
  errorMessage = null,
}: TopOpportunitiesProps) {
  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--b70-text)]">
            Top opportunities
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
            By alpha score, ROI & confidence
          </p>
        </div>
        <Link
          href="/opportunities"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {errorMessage ? (
          <p className="text-xs text-[var(--b70-text-muted)]">
            Data temporarily unavailable.{" "}
            <span className="font-mono">{errorMessage}</span>
          </p>
        ) : opportunities.length === 0 ? (
          <p className="text-xs text-[var(--b70-text-muted)]">
            No ranked opportunities yet. Once the engines see enough flow, the
            highest conviction plays will appear here.
          </p>
        ) : (
          opportunities.slice(0, 4).map((opp) => (
            <div key={opp.id} className="transition-opacity duration-300">
              <OpportunityCard
                opportunity={opp}
                href={`/opportunities/${opp.slug}`}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
