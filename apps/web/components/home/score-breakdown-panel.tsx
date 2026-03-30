"use client";

import type { Opportunity } from "@/lib/types";
import { factorPercent } from "@/lib/block70-score";
import { PaywallSection } from "@/components/paywall/paywall-section";
import { clsx } from "clsx";

type Row = { label: string; value: number };

function buildRows(opp: Opportunity): Row[] {
  return [
    { label: "Confidence", value: factorPercent(opp.confidence_score) },
    { label: "Liquidity", value: factorPercent(opp.liquidity_score) },
    { label: "Upside", value: factorPercent(opp.upside_score) },
    { label: "Freshness", value: factorPercent(opp.freshness_score) },
    { label: "Accessibility", value: factorPercent(opp.accessibility_score) },
    { label: "Risk model", value: factorPercent(opp.risk_score) },
    { label: "Difficulty", value: factorPercent(opp.difficulty_score) },
  ];
}

function BreakdownInner({ opp }: { opp: Opportunity }) {
  const rows = buildRows(opp);
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
        Score breakdown
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-0.5 flex justify-between text-[11px]">
              <span className="text-[var(--b70-text-muted)]">{r.label}</span>
              <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-text)]">
                {r.value}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--b70-border)]">
              <div
                className={clsx(
                  "h-full rounded-full transition-[width] duration-700",
                  r.value >= 70
                    ? "bg-emerald-500/80"
                    : r.value >= 40
                      ? "bg-amber-500/70"
                      : "bg-slate-500/60",
                )}
                style={{ width: `${Math.min(100, r.value)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {opp.estimated_roi_percent != null ? (
        <p className="border-t border-[var(--b70-border)] pt-2 text-[11px] text-[var(--b70-text-muted)]">
          <span className="font-medium text-[var(--b70-text)]">Modeled ROI: </span>
          {opp.estimated_roi_percent.toFixed(1)}%
        </p>
      ) : null}
    </div>
  );
}

type Props = {
  opportunity: Opportunity | null | undefined;
  className?: string;
};

export function ScoreBreakdownPanel({ opportunity, className }: Props) {
  if (!opportunity) {
    return (
      <div
        className={clsx(
          "rounded-xl border border-dashed border-[var(--b70-border)] p-4 text-center text-xs text-[var(--b70-text-muted)]",
          className,
        )}
      >
        No opportunity in feed yet.
      </div>
    );
  }

  return (
    <div className={className}>
      <PaywallSection
        feature="opportunities_full"
        title="Full score breakdown"
        subtitle="See factor-level drivers, modeled ROI context, and thesis-grade detail on Elite or Quant."
      >
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
          <BreakdownInner opp={opportunity} />
        </div>
      </PaywallSection>
    </div>
  );
}
