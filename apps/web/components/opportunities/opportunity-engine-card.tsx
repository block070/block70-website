import Link from "next/link";
import { Clock, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import type { Opportunity } from "@/lib/types";
import { SaveToWatchlist } from "@/components/opportunities/save-to-watchlist";
import {
  actionSketchFromEstimates,
  confidencePercent,
  modelScorePercent,
  normalizedRisk,
  presentOpportunityType,
  supportingSignalFlags,
  timeHorizon,
  urgencyLabel,
  whySummaryLine,
} from "@/lib/opportunity-present";

type Props = {
  opportunity: Opportunity;
  href: string;
  /** When true, show compact action sketch row */
  showActionSketch?: boolean;
};

function riskStyles(risk: ReturnType<typeof normalizedRisk>): string {
  if (risk === "low")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (risk === "high")
    return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
}

export function OpportunityEngineCard({
  opportunity,
  href,
  showActionSketch = true,
}: Props) {
  const presented = presentOpportunityType(opportunity);
  const conf = confidencePercent(opportunity);
  const model = modelScorePercent(opportunity);
  const risk = normalizedRisk(opportunity);
  const horizon = timeHorizon(opportunity);
  const signals = supportingSignalFlags(opportunity);
  const why = whySummaryLine(opportunity);
  const urgency = urgencyLabel(opportunity);
  const sketch = showActionSketch ? actionSketchFromEstimates(opportunity) : null;
  const sym = opportunity.asset_symbol ?? opportunity.base_symbol ?? "—";
  const hasSketchNumbers = !!(sketch?.entryHint || sketch?.exitHint);

  return (
    <article
      className={clsx(
        "relative overflow-hidden rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm transition-colors",
        "hover:border-[var(--b70-crypto-blue)]/35",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-[family-name:var(--font-jetbrains)] text-base font-semibold text-[var(--b70-text)]">
              {sym}
            </span>
            <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
              {presented.label}
            </span>
            <span
              className={clsx(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                riskStyles(risk),
              )}
            >
              Risk {risk}
            </span>
            <span className="rounded-full border border-[var(--b70-crypto-blue)]/30 bg-[var(--b70-crypto-blue)]/10 px-2 py-0.5 text-[10px] text-[var(--b70-crypto-blue)]">
              {horizon.label}
            </span>
          </div>

          {urgency ? (
            <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--b70-crypto-blue)]">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {urgency}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 text-xs">
            <div>
              <span className="text-[var(--b70-text-muted)]">Confidence </span>
              <span className="font-[family-name:var(--font-jetbrains)] font-semibold text-[var(--b70-text)]">
                {conf}%
              </span>
            </div>
            <div>
              <span className="text-[var(--b70-text-muted)]">Model score </span>
              <span className="font-[family-name:var(--font-jetbrains)] font-semibold text-[var(--b70-text)]">
                {model}%
              </span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
              Why it matters
            </p>
            <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-[var(--b70-text-muted)]">
              {why}
            </p>
            <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
              Full AI analysis on the detail page.
            </p>
          </div>

          {signals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {signals.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-0.5 text-[10px] text-[var(--b70-text)]"
                >
                  <TrendingUp className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  {s}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href={href}
            className="rounded-lg bg-[var(--b70-crypto-blue)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--b70-crypto-blue)] hover:bg-[var(--b70-crypto-blue)]/25"
          >
            Open thesis
          </Link>
          <SaveToWatchlist opportunity={opportunity} />
        </div>
      </div>

      {sketch && hasSketchNumbers ? (
        <div className="mt-3 border-t border-[var(--b70-border)] pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
            Action sketch (illustrative)
          </p>
          <ul className="mt-1.5 grid gap-1 text-[11px] text-[var(--b70-text)] sm:grid-cols-3">
            {sketch.entryHint ? (
              <li>
                <span className="text-[var(--b70-text-muted)]">Entry / size · </span>
                {sketch.entryHint}
              </li>
            ) : null}
            {sketch.exitHint ? (
              <li>
                <span className="text-[var(--b70-text-muted)]">Target · </span>
                {sketch.exitHint}
              </li>
            ) : null}
            {sketch.stopHint ? (
              <li>
                <span className="text-[var(--b70-text-muted)]">Stop sketch · </span>
                {sketch.stopHint}
              </li>
            ) : null}
          </ul>
          <p className="mt-2 text-[10px] leading-snug text-amber-800/90 dark:text-amber-200/90">
            {sketch.disclaimer}
          </p>
        </div>
      ) : sketch ? (
        <p className="mt-3 border-t border-[var(--b70-border)] pt-3 text-[10px] text-[var(--b70-text-muted)]">
          {sketch.disclaimer} Detail page has feasibility and simulation where available.
        </p>
      ) : null}
    </article>
  );
}
