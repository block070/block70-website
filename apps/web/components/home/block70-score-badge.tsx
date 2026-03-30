"use client";

import { clsx } from "clsx";
import {
  scoreTier,
  scoreToPercent,
  tierLabel,
  type Block70ScoreTier,
} from "@/lib/block70-score";

type Props = {
  totalScore: number | null | undefined;
  className?: string;
  showNumeric?: boolean;
};

const tierStyles: Record<
  Block70ScoreTier,
  { wrap: string; pulse: boolean }
> = {
  rare: {
    wrap:
      "border-amber-400/50 bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/30",
    pulse: true,
  },
  strong: {
    wrap: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    pulse: false,
  },
  developing: {
    wrap: "border-[var(--b70-border)] bg-[var(--b70-bg)] text-[var(--b70-text-muted)]",
    pulse: false,
  },
};

export function Block70ScoreBadge({
  totalScore,
  className,
  showNumeric = true,
}: Props) {
  const pct = scoreToPercent(totalScore);
  const tier = scoreTier(pct);
  const st = tierStyles[tier];

  return (
    <div
      className={clsx(
        "inline-flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5",
        st.wrap,
        st.pulse && "b70-score-tier-pulse",
        className,
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-90">
        Block70 Score
      </span>
      <div className="flex flex-wrap items-baseline gap-2">
        {showNumeric ? (
          <span className="font-[family-name:var(--font-jetbrains)] text-lg font-bold tabular-nums">
            {pct}
          </span>
        ) : null}
        <span className="text-[10px] font-medium leading-tight">{tierLabel(tier)}</span>
      </div>
    </div>
  );
}
