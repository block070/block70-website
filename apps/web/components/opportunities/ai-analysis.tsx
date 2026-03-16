"use client";

import { useEffect, useState } from "react";

import { getOpportunityAnalysis } from "@/lib/api";
import type { Opportunity } from "@/lib/types";

type Props = {
  opportunity: Opportunity;
};

type Analysis = Awaited<ReturnType<typeof getOpportunityAnalysis>>;

export function AiAnalysis({ opportunity }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getOpportunityAnalysis(opportunity.id);
        if (cancelled) return;
        setAnalysis(data);
      } catch {
        if (!cancelled) {
          setError("Unable to load AI analysis for this opportunity.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [opportunity.id]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        Having the AI desk read this opportunity and draft a short memo…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
        {error}
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No AI analysis is available for this opportunity yet.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        AI Opportunity Analysis
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Structured commentary from Block70&apos;s research agent. This is not
        investment advice; use it to pressure-test your own view.
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Summary
          </h4>
          <p className="mt-1 text-xs text-slate-200">
            {analysis.analysis_summary}
          </p>
        </div>

        {analysis.key_factors && (
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Key Factors
            </h4>
            <p className="mt-1 whitespace-pre-line text-xs text-slate-200">
              {analysis.key_factors}
            </p>
          </div>
        )}

        {analysis.risk_assessment && (
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Risk Assessment
            </h4>
            <p className="mt-1 text-xs text-slate-200">
              {analysis.risk_assessment}
            </p>
          </div>
        )}

        {analysis.trade_strategy && (
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Suggested Strategy
            </h4>
            <p className="mt-1 text-xs text-slate-200">
              {analysis.trade_strategy}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

