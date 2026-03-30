"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Hourglass, ShieldCheck, Zap } from "lucide-react";

import type { Opportunity } from "@/lib/types";
import { OpportunityEngineCard } from "@/components/opportunities/opportunity-engine-card";
import { OpportunityHero } from "@/components/opportunities/opportunity-hero";
import { OpportunitiesPerformanceStrip } from "@/components/opportunities/opportunities-performance-strip";
import {
  AdvancedFilters,
  type AdvancedFiltersValue,
} from "@/components/opportunities/advanced-filters";
import { getCurrentUser } from "@/lib/auth";
import { PaywallSection } from "@/components/paywall/paywall-section";
import { hasPlanAccess } from "@/lib/plan-tier";
import {
  confidencePercent,
  matchesShortHorizon,
  normalizedRisk,
} from "@/lib/opportunity-present";
import { clsx } from "clsx";

type Props = {
  initialOpportunities: Opportunity[];
  backendError: string | null;
  initialChainFilter?: string;
};

const TYPES = ["arbitrage", "mining", "wallet", "airdrop", "node"];

type PlanType = "free" | "pro" | "elite" | "quant";

export function OpportunitiesListClient({
  initialOpportunities,
  backendError,
  initialChainFilter = "",
}: Props) {
  const [typeFilter, setTypeFilter] = useState<string | "">("");
  const [chainFilter, setChainFilter] = useState(initialChainFilter);
  const [minScoreFilter, setMinScoreFilter] = useState<string>("");
  const [presetHighConfidence, setPresetHighConfidence] = useState(false);
  const [presetLowRisk, setPresetLowRisk] = useState(false);
  const [presetShortHorizon, setPresetShortHorizon] = useState(false);
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

  const heroOpportunity = initialOpportunities[0] ?? null;
  const heroId = heroOpportunity?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      try {
        const u = await getCurrentUser();
        const pt = (u.plan_type ?? "free").toLowerCase() as PlanType;
        const next: PlanType =
          pt === "quant" || pt === "elite" || pt === "pro" ? pt : "free";
        if (!cancelled) setPlanType(next);
      } catch {
        if (!cancelled) setPlanType("free");
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
      if (chainFilter && op.chain) {
        const slugNorm = chainFilter.toLowerCase().replace(/-/g, " ");
        const chainNorm = op.chain.toLowerCase();
        if (!chainNorm.includes(slugNorm)) return false;
      }
      const minScore = parseFloat(minScoreFilter);
      if (!Number.isNaN(minScore) && op.total_score * 100 < minScore) {
        return false;
      }

      if (presetHighConfidence && confidencePercent(op) < 70) return false;
      if (presetLowRisk && normalizedRisk(op) !== "low") return false;
      if (presetShortHorizon && !matchesShortHorizon(op)) return false;

      if (hasPlanAccess(planType, "pro")) {
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
          if (
            (op.risk_level ?? "").toLowerCase() !==
            advancedFilters.riskLevel.toLowerCase()
          ) {
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
    presetHighConfidence,
    presetLowRisk,
    presetShortHorizon,
    planType,
    advancedFilters,
  ]);

  const gridOpportunities = useMemo(() => {
    if (heroId == null) return filtered;
    return filtered.filter((op) => op.id !== heroId);
  }, [filtered, heroId]);

  const onlyHeroMatches =
    heroId != null &&
    filtered.length === 1 &&
    filtered[0]?.id === heroId;

  return (
    <>
      {!backendError && heroOpportunity ? (
        <OpportunityHero
          opportunity={heroOpportunity}
          href={`/opportunities/${heroOpportunity.slug}`}
        />
      ) : null}

      <PaywallSection
        feature="opportunities_full"
        title="Full performance analytics"
        subtitle="See the full strip with drawdown, Sharpe-style context, and cohort benchmarks on Elite or Quant."
      >
        <OpportunitiesPerformanceStrip />
      </PaywallSection>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
          Quick filters
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!backendError}
            onClick={() => setPresetHighConfidence((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              presetHighConfidence
                ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/15 text-[var(--b70-crypto-blue)]"
                : "border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)] hover:border-[var(--b70-crypto-blue)]/40",
            )}
          >
            <Zap className="h-3.5 w-3.5" aria-hidden />
            High confidence (≥70%)
          </button>
          <button
            type="button"
            disabled={!!backendError}
            onClick={() => setPresetLowRisk((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              presetLowRisk
                ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/15 text-[var(--b70-crypto-blue)]"
                : "border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)] hover:border-[var(--b70-crypto-blue)]/40",
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Low risk
          </button>
          <button
            type="button"
            disabled={!!backendError}
            onClick={() => setPresetShortHorizon((v) => !v)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              presetShortHorizon
                ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/15 text-[var(--b70-crypto-blue)]"
                : "border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)] hover:border-[var(--b70-crypto-blue)]/40",
            )}
          >
            <Hourglass className="h-3.5 w-3.5" aria-hidden />
            Short horizon
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              <Filter className="h-3 w-3" aria-hidden />
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-xs text-[var(--b70-text)] outline-none focus:border-[var(--b70-crypto-blue)]"
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
            <label className="text-[11px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              Chain
            </label>
            <input
              type="text"
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              placeholder="e.g. solana"
              className="h-8 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-xs text-[var(--b70-text)] outline-none placeholder:text-[var(--b70-text-muted)] focus:border-[var(--b70-crypto-blue)]"
              disabled={!!backendError}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              Min score (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(e.target.value)}
              placeholder="e.g. 60"
              className="h-8 w-24 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 text-xs text-[var(--b70-text)] outline-none placeholder:text-[var(--b70-text-muted)] focus:border-[var(--b70-crypto-blue)]"
              disabled={!!backendError}
            />
          </div>
        </div>

        {backendError ? (
          <p className="mt-3 text-[11px] text-rose-300">{backendError}</p>
        ) : null}
      </section>

      {planType !== "free" && !backendError ? (
        <div className="mt-3">
          <AdvancedFilters
            value={advancedFilters}
            onChange={(next) => {
              setAdvancedFilters(next);
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
          <div className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-card)]/80 p-6 text-center text-sm text-[var(--b70-text-muted)]">
            No opportunities match the current filters. As Block70 detects new
            alpha across chains, they&apos;ll appear here.
          </div>
        ) : onlyHeroMatches ? (
          <p className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/80 px-4 py-3 text-center text-xs text-[var(--b70-text-muted)]">
            Your filters narrow to the highlighted pick above—open the thesis for
            full context.
          </p>
        ) : (
          gridOpportunities.map((opportunity) => (
            <OpportunityEngineCard
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
