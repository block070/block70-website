"use client";

import { clsx } from "clsx";
import { Check, Minus } from "lucide-react";
import {
  PRICING_FEATURE_ROWS,
  type PricingCell,
  type PricingTierCol,
} from "@/lib/pricing-features";

const TIERS: { key: PricingTierCol; label: string }[] = [
  { key: "free", label: "Free" },
  { key: "pro", label: "Pro" },
  { key: "elite", label: "Elite" },
  { key: "quant", label: "Quant" },
];

function CellIcon({ value }: { value: PricingCell }) {
  if (value === true) {
    return (
      <span className="inline-flex justify-center text-emerald-500" aria-label="Included">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex justify-center text-[var(--b70-text-muted)] opacity-50" aria-label="Not included">
        <Minus className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="text-center text-[11px] font-medium leading-tight text-[var(--b70-text-muted)]">
      {value}
    </span>
  );
}

export function FeatureComparisonTable({ className }: { className?: string }) {
  return (
    <div className={clsx("overflow-x-auto rounded-xl border border-[var(--b70-border)]", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--b70-border)] bg-[var(--b70-card-elevated)]">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-[var(--b70-card-elevated)] px-4 py-3 text-left text-xs font-semibold text-[var(--b70-text-muted)]"
            >
              Feature
            </th>
            {TIERS.map((t) => (
              <th
                key={t.key}
                scope="col"
                className={clsx(
                  "px-3 py-3 text-center text-xs font-semibold",
                  t.key === "pro" && "text-[var(--b70-crypto-blue)]",
                  t.key === "elite" && "text-amber-200/90",
                  t.key !== "pro" && t.key !== "elite" && "text-[var(--b70-text)]",
                )}
              >
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PRICING_FEATURE_ROWS.map((row) => (
            <tr
              key={row.label}
              className="border-b border-[var(--b70-border)] last:border-b-0 transition-colors hover:bg-[var(--b70-bg)]/80"
            >
              <th
                scope="row"
                className="sticky left-0 z-10 bg-[var(--b70-card)] px-4 py-3 text-left text-xs font-medium text-[var(--b70-text)] shadow-[2px_0_6px_-2px_rgba(0,0,0,0.2)]"
              >
                {row.label}
              </th>
              <td className="px-3 py-3">
                <CellIcon value={row.free} />
              </td>
              <td className="px-3 py-3">
                <CellIcon value={row.pro} />
              </td>
              <td className="px-3 py-3">
                <CellIcon value={row.elite} />
              </td>
              <td className="px-3 py-3">
                <CellIcon value={row.quant} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
