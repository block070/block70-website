"use client";

import type { SortKey } from "./chains-table";
import { clsx } from "clsx";

const FILTERS: { key: SortKey; label: string }[] = [
  { key: "netflow", label: "Top inflow" },
  { key: "tvl", label: "Largest TVL" },
  { key: "tvl_change", label: "Fastest 24h" },
  { key: "momentum", label: "Momentum" },
  { key: "declining", label: "Weakest 24h" },
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
              ? "border-crypto-blue/50 bg-crypto-blue/15 text-crypto-blue"
              : "border-[var(--b70-border)] bg-[var(--b70-card)] text-[var(--b70-text-muted)] hover:border-[var(--b70-border)] hover:text-[var(--b70-text)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
