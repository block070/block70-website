"use client";

import { clsx } from "clsx";
import {
  scoreMarketTone,
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
  { pulse: boolean }
> = {
  rare: { pulse: true },
  strong: { pulse: false },
  developing: { pulse: false },
};

const toneWrap: Record<"bullish" | "bearish" | "neutral", string> = {
  bullish:
    "border-emerald-500/45 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500/20",
  bearish:
    "border-rose-500/45 bg-rose-500/12 text-rose-900 dark:text-rose-100 ring-1 ring-rose-500/20",
  neutral:
    "border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-200 ring-1 ring-slate-500/15",
};

export function Block70ScoreBadge({
  totalScore,
  className,
  showNumeric = true,
}: Props) {
  const pct = scoreToPercent(totalScore);
  const tier = scoreTier(pct);
  const tone = scoreMarketTone(pct);
  const st = tierStyles[tier];
  const wrap = toneWrap[tone];

  return (
    <div
      className={clsx(
        "inline-flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5",
        wrap,
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
