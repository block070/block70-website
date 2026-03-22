"use client";

import { memo } from "react";
import { Tooltip } from "@/components/ui/tooltip";

const TOOLTIP = "Momentum score combines TVL change and capital inflow";

function normalizeMomentum(score: number, min: number, max: number): number {
  if (max <= min) return 50;
  const raw = ((score - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, raw));
}

type Props = {
  score: number;
  minScore: number;
  maxScore: number;
};

export const MomentumCell = memo(function MomentumCell({
  score,
  minScore,
  maxScore,
}: Props) {
  const normalized = normalizeMomentum(score, minScore, maxScore);
  const isPositive = score >= 0;

  return (
    <Tooltip label={TOOLTIP}>
      <div className="flex w-24 min-w-0 flex-col items-end gap-0.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full ${isPositive ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${normalized}%` }}
          />
        </div>
        <span
          className={`text-[11px] font-medium ${
            isPositive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {score.toFixed(1)}
        </span>
      </div>
    </Tooltip>
  );
});
