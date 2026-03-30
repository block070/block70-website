"use client";

export type PlanCardProps = {
  name: string;
  badge?: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel: string;
  disabled?: boolean;
  onClick: () => void;
};

export function PlanCard({
  name,
  badge,
  price,
  description,
  features,
  highlighted,
  ctaLabel,
  disabled,
  onClick,
}: PlanCardProps) {
  return (
    <div
      className={`flex flex-col justify-between rounded-xl border p-5 ${
        highlighted
          ? "border-emerald-500/60 bg-emerald-500/5 shadow-lg shadow-emerald-500/20"
          : "border-slate-800 bg-slate-950/40"
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-50">{name}</h2>
          {badge ? (
            <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-bold text-slate-50">{price}</p>
        <p className="text-xs text-slate-400">{description}</p>
        <ul className="mt-4 space-y-1 text-xs text-slate-300">
          {features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className="mt-6 w-full rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        onClick={onClick}
        disabled={disabled}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
