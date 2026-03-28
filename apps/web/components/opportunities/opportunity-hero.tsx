import Link from "next/link";
import { Crown, Sparkles } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import {
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
};

export function OpportunityHero({ opportunity, href }: Props) {
  const presented = presentOpportunityType(opportunity);
  const conf = confidencePercent(opportunity);
  const model = modelScorePercent(opportunity);
  const risk = normalizedRisk(opportunity);
  const horizon = timeHorizon(opportunity);
  const signals = supportingSignalFlags(opportunity).slice(0, 3);
  const why = whySummaryLine(opportunity);
  const urgency = urgencyLabel(opportunity);
  const sym = opportunity.asset_symbol ?? opportunity.base_symbol ?? "—";

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-[var(--b70-crypto-blue)]/35 bg-[var(--b70-card)] p-5 shadow-lg md:p-6">
      <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-[var(--b70-crypto-blue)]/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--b70-crypto-blue)]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              Best opportunity right now
            </span>
            {urgency ? (
              <span className="text-[11px] font-medium text-[var(--b70-text-muted)]">{urgency}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <h2 className="font-[family-name:var(--font-jetbrains)] text-2xl font-bold tracking-tight text-[var(--b70-text)] md:text-3xl">
              {sym}
            </h2>
            <span className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1 text-xs font-medium text-[var(--b70-text)]">
              {presented.label}
            </span>
            <span className="rounded-lg border border-[var(--b70-border)] px-2 py-1 text-xs capitalize text-[var(--b70-text-muted)]">
              Risk {risk} · {horizon.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-[var(--b70-crypto-blue)]/50 bg-[var(--b70-bg)]">
              <span className="text-[10px] font-semibold uppercase text-[var(--b70-text-muted)]">
                Conf
              </span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-[var(--b70-crypto-blue)]">
                {conf}
              </span>
              <span className="text-[10px] text-[var(--b70-text-muted)]">Model {model}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Why it matters
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--b70-text-muted)]">{why}</p>
              {signals.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {signals.map((s) => (
                    <li
                      key={s}
                      className="rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-0.5 text-[10px] text-[var(--b70-text)]"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <Link
            href={href}
            className="inline-flex justify-center rounded-xl bg-[var(--b70-crypto-blue)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Open full thesis
          </Link>
          <p className="max-w-xs text-[10px] text-[var(--b70-text-muted)]">
            Ranked by model total score. Not advice—verify on detail before acting.
          </p>
        </div>
      </div>
    </section>
  );
}
