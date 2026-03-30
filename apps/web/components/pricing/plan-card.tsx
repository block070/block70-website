"use client";

import { clsx } from "clsx";

export type PlanEmphasis = "popular" | "best_value";

export type PlanCardProps = {
  name: string;
  badge?: string;
  price: string;
  description: string;
  features: string[];
  /** Legacy: maps to emphasis "popular" if true and emphasis unset */
  highlighted?: boolean;
  emphasis?: PlanEmphasis | null;
  ctaLabel: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

export function PlanCard({
  name,
  badge,
  price,
  description,
  features,
  highlighted,
  emphasis: emphasisProp,
  ctaLabel,
  disabled,
  onClick,
  className,
}: PlanCardProps) {
  const emphasis =
    emphasisProp ?? (highlighted ? "popular" : null);

  return (
    <div
      className={clsx(
        "flex min-h-full flex-col justify-between rounded-xl border p-5 transition-all duration-200",
        emphasis === "popular" &&
          "border-[var(--b70-crypto-blue)]/55 bg-[var(--b70-crypto-blue)]/8 shadow-lg shadow-[var(--b70-crypto-blue)]/15",
        emphasis === "best_value" &&
          "border-amber-500/55 bg-gradient-to-b from-amber-500/12 to-[var(--b70-card)] shadow-lg shadow-amber-900/20",
        !emphasis && "border-[var(--b70-border)] bg-[var(--b70-card)] hover:border-[var(--b70-crypto-blue)]/25",
        className,
      )}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--b70-text)]">{name}</h2>
            {emphasis === "popular" ? (
              <span className="rounded-full border border-[var(--b70-crypto-blue)]/50 bg-[var(--b70-crypto-blue)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-crypto-blue)]">
                Most popular
              </span>
            ) : null}
            {emphasis === "best_value" ? (
              <span className="rounded-full border border-amber-500/45 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                Best value
              </span>
            ) : null}
          </div>
          {badge ? (
            <span className="inline-block rounded-full border border-[var(--b70-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-bold text-[var(--b70-text)]">{price}</p>
        <p className="text-xs text-[var(--b70-text-muted)]">{description}</p>
        <ul className="mt-4 space-y-1 text-xs text-[var(--b70-text)]">
          {features.map((f) => (
            <li key={f} className="text-[var(--b70-text-muted)]">
              <span className="text-[var(--b70-crypto-blue)]">•</span> {f}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className={clsx(
          "mt-6 w-full rounded-lg px-3 py-2.5 text-xs font-semibold transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50",
          emphasis === "best_value"
            ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
            : "bg-[var(--b70-crypto-blue)] text-white hover:opacity-90",
        )}
        onClick={onClick}
        disabled={disabled}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
