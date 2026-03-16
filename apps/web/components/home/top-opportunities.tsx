import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";

type TopOpportunitiesProps = {
  opportunities: Opportunity[];
};

export function TopOpportunities({ opportunities }: TopOpportunitiesProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">
            Top opportunities
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            By alpha score, ROI & confidence
          </p>
        </div>
        <Link
          href="/opportunities"
          className="text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {opportunities.length === 0 ? (
          <p className="text-xs text-slate-500">No opportunities yet.</p>
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
