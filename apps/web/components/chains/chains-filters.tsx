"use client";

import type { SortKey } from "./chains-table";
import { clsx } from "clsx";

const FILTERS: { key: SortKey; label: string }[] = [
  { key: "netflow", label: "Top Inflow" },
  { key: "tvl_change", label: "Top Gainers" },
  { key: "declining", label: "Declining" },
];

type Props = {
  active: SortKey;
  onChange: (key: SortKey) => void;
};

export function ChainsFilters({ active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={clsx(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
            active === key
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
              : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-300",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
