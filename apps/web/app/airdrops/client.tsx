"use client";

import { useMemo, useState } from "react";

import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";

type Props = {
  initialOpportunities: Opportunity[];
  backendError: string | null;
};

const DIFFICULTY_LEVELS = ["low", "medium", "high"] as const;

export function AirdropsClient({ initialOpportunities, backendError }: Props) {
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");

  const filtered = useMemo(() => {
    return initialOpportunities.filter((op) => {
      if (op.type !== "airdrop") return false;
      if (
        difficultyFilter &&
        op.difficulty_level &&
        op.difficulty_level.toLowerCase() !== difficultyFilter.toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [initialOpportunities, difficultyFilter]);

  return (
    <>
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Difficulty
            </label>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
              disabled={!!backendError}
            >
              <option value="">All</option>
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>
        {backendError ? (
          <p className="mt-3 text-[11px] text-rose-200">{backendError}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
            No airdrop opportunities match the current filters. As Block70
            discovers new programs and quests, they&apos;ll appear here.
          </div>
        ) : (
          filtered.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              href={`/opportunities/${opportunity.slug}`}
            />
          ))
        )}
      </section>
    </>
  );
}

