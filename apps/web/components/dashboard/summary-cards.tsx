import type { Opportunity } from "@/lib/types";

type Props = {
  opportunities: Opportunity[];
};

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatScore(score: number | null | undefined, digits = 0): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(digits)}%`;
}

export function DashboardSummaryCards({ opportunities }: Props) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="Best Opportunity Right Now" value="No data yet" />
        <SummaryCard title="Highest Score" value="–" />
        <SummaryCard title="Average ROI" value="–" />
        <SummaryCard title="Active Opportunities" value="0" />
      </div>
    );
  }

  const sortedByScore = [...opportunities].sort(
    (a, b) => b.total_score - a.total_score,
  );
  const best = sortedByScore[0];
  const highestScore = best.total_score ?? 0;

  const roiValues = opportunities
    .map((o) => o.estimated_roi_percent)
    .filter((v): v is number => v != null);
  const avgRoi =
    roiValues.length > 0
      ? roiValues.reduce((sum, v) => sum + v, 0) / roiValues.length
      : null;

  const activeCount = opportunities.length;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <SummaryCard
        title="Best Opportunity Right Now"
        label={best.type}
        value={best.title}
        accent={true}
        secondary={`${best.chain ?? "multi-chain"} · ${formatScore(
          best.total_score,
        )} score`}
      />
      <SummaryCard
        title="Highest Score"
        value={formatScore(highestScore, 0)}
        secondary="Weighted opportunity score"
      />
      <SummaryCard
        title="Average ROI"
        value={formatPercent(avgRoi, 1)}
        secondary="Across all active opportunities"
      />
      <SummaryCard
        title="Active Opportunities"
        value={String(activeCount)}
        secondary="Currently on the radar"
      />
    </div>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  secondary?: string;
  label?: string;
  accent?: boolean;
};

function SummaryCard({
  title,
  value,
  secondary,
  label,
  accent,
}: SummaryCardProps) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-lg ${
        accent ? "shadow-emerald-500/20" : "shadow-black/30"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-50 line-clamp-2">
            {value}
          </p>
          {secondary ? (
            <p className="mt-1 text-[11px] text-slate-400">{secondary}</p>
          ) : null}
        </div>
        {label ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
            {label}
          </span>
        ) : null}
      </div>
      {accent ? (
        <div className="pointer-events-none absolute -right-8 -top-12 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
      ) : null}
    </section>
  );
}

