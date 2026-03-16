import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";

type OpportunityFeedProps = {
  opportunities?: Opportunity[];
  isLoading?: boolean;
};

export function OpportunityFeed({
  opportunities,
  isLoading = false,
}: OpportunityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
        No opportunities to display yet. Trigger a scan in the backend or check
        back soon as new alpha is discovered.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {opportunities.map((opportunity) => (
        <OpportunityCard
          key={opportunity.id}
          opportunity={opportunity}
          href={`/opportunities/${opportunity.slug}`}
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-slate-800" />
          <div className="h-4 w-48 rounded bg-slate-800" />
          <div className="h-3 w-64 rounded bg-slate-900" />
        </div>
        <div className="space-y-2 text-right">
          <div className="h-3 w-20 rounded bg-slate-800" />
          <div className="h-5 w-16 rounded bg-slate-800" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="h-3 w-40 rounded bg-slate-900" />
        <div className="h-6 w-28 rounded-full bg-slate-900" />
      </div>
    </div>
  );
}

