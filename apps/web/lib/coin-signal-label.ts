/** Block70 investment signal derived from composite score (aligned with gauge). */
export type InvestmentLabel = "Strong Buy" | "Hold" | "Sell";

export function investmentLabelFromScore(score: number): InvestmentLabel {
  if (score >= 68) return "Strong Buy";
  if (score >= 38) return "Hold";
  return "Sell";
}
