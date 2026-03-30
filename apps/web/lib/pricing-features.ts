/**
 * Rows for the public pricing comparison table.
 * Aligns conceptually with `FEATURES` in plan-tier.ts (server is source of truth for enforcement).
 */

export type PricingTierCol = "free" | "pro" | "elite" | "quant";

export type PricingCell = boolean | string;

export type PricingFeatureRow = {
  label: string;
  free: PricingCell;
  pro: PricingCell;
  elite: PricingCell;
  quant: PricingCell;
};

export const PRICING_FEATURE_ROWS: PricingFeatureRow[] = [
  {
    label: "Market & category data",
    free: true,
    pro: true,
    elite: true,
    quant: true,
  },
  {
    label: "Block70 Score (teaser / surface)",
    free: true,
    pro: true,
    elite: true,
    quant: true,
  },
  {
    label: "Full score breakdown & opportunity analytics",
    free: false,
    pro: false,
    elite: true,
    quant: true,
  },
  {
    label: "Opportunities list depth",
    free: "Delayed / capped",
    pro: "Near real-time",
    elite: "Full desk",
    quant: "Full desk",
  },
  {
    label: "Smart wallet directory depth",
    free: "Preview",
    pro: "Extended",
    elite: "Full",
    quant: "Full",
  },
  {
    label: "Signals feed tier",
    free: "Low (delayed)",
    pro: "Medium",
    elite: "High (dense)",
    quant: "High (dense)",
  },
  {
    label: "AI search / Copilot (daily guidance)",
    free: "5 / day",
    pro: "50 / day",
    elite: "Unlimited (fair use)",
    quant: "Unlimited (fair use)",
  },
  {
    label: "REST API & automation keys",
    free: false,
    pro: false,
    elite: false,
    quant: true,
  },
];
