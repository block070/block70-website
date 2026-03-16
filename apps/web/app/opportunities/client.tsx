"use client";

import { useEffect, useMemo, useState } from "react";

import type { Opportunity } from "@/lib/types";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import {
  AdvancedFilters,
  type AdvancedFiltersValue,
} from "@/components/opportunities/advanced-filters";
import { getPremiumAlerts } from "@/lib/api";

type Props = {
  initialOpportunities: Opportunity[];
  backendError: string | null;
};

const TYPES = ["arbitrage", "mining", "wallet", "airdrop", "node"];

type PlanType = "free" | "pro" | "elite";

const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

export function OpportunitiesListClient({
  initialOpportunities,
  backendError,
}: Props) {
  const [typeFilter, setTypeFilter] = useState<string | "">("");
  const [chainFilter, setChainFilter] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState<string>("");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersValue>({
    roi: "",
    score: "",
    confidence: "",
    chain: "",
    opportunityType: "",
    riskLevel: "",
    difficulty: "",
  });
  const [planType, setPlanType] = useState<PlanType>("free");

  useEffect(() => {
    // Determine current plan based on PremiumAlertSubscription records.
    // For MVP, we derive the plan from the highest plan_type associated
    // with the configured user identifier (or fall back to free).
    const userIdentifier =
      process.env.NEXT_PUBLIC_USER_IDENTIFIER ?? "demo-user";

    let cancelled = false;

    async function loadPlan() {
      try {
        const subs = await getPremiumAlerts();
        const relevant = subs.filter(
          (s) => s.user_identifier === userIdentifier,
        );
        let best: PlanType = "free";
        for (const sub of relevant) {
          const plan = (sub.plan_type ?? "free") as PlanType;
          if (PLAN_RANK[plan] > PLAN_RANK[best]) {
            best = plan;
          }
        }
        if (!cancelled) {
          setPlanType(best);
        }
      } catch {
        if (!cancelled) {
          setPlanType("free");
        }
      }
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return initialOpportunities.filter((op) => {
      if (typeFilter && op.type !== typeFilter) return false;
      if (chainFilter && op.chain && !op.chain.toLowerCase().includes(chainFilter.toLowerCase())) {
        return false;
      }
      const minScore = parseFloat(minScoreFilter);
      if (!Number.isNaN(minScore) && op.total_score * 100 < minScore) {
        return false;
      }

       // Apply advanced filters only for non-free plans.
       if (planType !== "free") {
         const minRoi = parseFloat(advancedFilters.roi);
         if (!Number.isNaN(minRoi)) {
           const roi = op.estimated_roi_percent ?? 0;
           if (roi < minRoi) {
             return false;
           }
         }

         const minConf = parseFloat(advancedFilters.confidence);
         if (!Number.isNaN(minConf)) {
           if (op.confidence_score * 100 < minConf) {
             return false;
           }
         }

         if (advancedFilters.riskLevel) {
           if ((op.risk_level ?? "").toLowerCase() !== advancedFilters.riskLevel.toLowerCase()) {
             return false;
           }
         }

         if (advancedFilters.difficulty) {
           if (
             (op.difficulty_level ?? "").toLowerCase() !==
             advancedFilters.difficulty.toLowerCase()
           ) {
             return false;
           }
         }
       }

      return true;
    });
  }, [
    initialOpportunities,
    typeFilter,
    chainFilter,
    minScoreFilter,
    planType,
    advancedFilters,
  ]);

  return (
    <>
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
              disabled={!!backendError}
            >
              <option value="">All</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Chain
            </label>
            <input
              type="text"
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              placeholder="e.g. solana"
              className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
              disabled={!!backendError}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Min Score (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(e.target.value)}
              placeholder="e.g. 60"
              className="h-8 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
              disabled={!!backendError}
            />
          </div>
        </div>

        {backendError ? (
          <p className="mt-3 text-[11px] text-rose-200">{backendError}</p>
        ) : null}
      </section>

      {planType !== "free" && !backendError ? (
        <div className="mt-3">
          <AdvancedFilters
            value={advancedFilters}
            onChange={(next) => {
              setAdvancedFilters(next);
              // Keep basic filters in sync where appropriate so UX feels coherent.
              if (next.opportunityType !== typeFilter) {
                setTypeFilter(next.opportunityType);
              }
              if (next.chain !== chainFilter) {
                setChainFilter(next.chain);
              }
              if (next.score !== minScoreFilter) {
                setMinScoreFilter(next.score);
              }
            }}
            disabled={!!backendError}
          />
        </div>
      ) : null}

      <section className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
            No opportunities match the current filters. As Block70 detects new
            alpha across chains, they&apos;ll appear here.
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

