import type { Opportunity } from "@/lib/types";

type Props = {
  opportunity: Opportunity;
};

function formatScore(score: number | null | undefined, digits = 0): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(digits)}%`;
}

export function ScoreBreakdown({ opportunity }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-50">Scoring breakdown</h3>
      <p className="mt-1 text-xs text-slate-400">
        Each opportunity is scored across multiple dimensions so Block70
        doesn&apos;t feel like a black box.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <ScoreBox
          label="Total score"
          value={formatScore(opportunity.total_score)}
          hint="Overall attractiveness of this opportunity."
          accent
        />
        <ScoreBox
          label="Confidence"
          value={formatScore(opportunity.confidence_score)}
          hint="How confident Block70 is in the data and thesis."
        />
        <ScoreBox
          label="Upside"
          value={formatScore(opportunity.upside_score)}
          hint="Relative upside potential vs. other opportunities."
        />
        <ScoreBox
          label="Freshness"
          value={formatScore(opportunity.freshness_score)}
          hint="How recently this opportunity was detected."
        />
        <ScoreBox
          label="Liquidity"
          value={formatScore(opportunity.liquidity_score)}
          hint="How easy it is to size into and out of this trade."
        />
        <ScoreBox
          label="Accessibility"
          value={formatScore(opportunity.accessibility_score)}
          hint="How easy it is for a typical user to execute."
        />
        <ScoreBox
          label="Risk"
          value={formatScore(opportunity.risk_score)}
          hint={`Higher is worse · current level: ${
            opportunity.risk_level ?? "n/a"
          }`}
        />
        <ScoreBox
          label="Difficulty"
          value={formatScore(opportunity.difficulty_score)}
          hint={`Higher is harder to execute · current level: ${
            opportunity.difficulty_level ?? "n/a"
          }`}
        />
      </div>
    </section>
  );
}

type ScoreBoxProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
};

function ScoreBox({ label, value, hint, accent }: ScoreBoxProps) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent
          ? "border-emerald-500/60 bg-emerald-500/5"
          : "border-slate-800 bg-slate-950/60"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-emerald-400">{value}</p>
      {hint ? (
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

