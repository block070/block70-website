// Hidden Gem predicate extracted for direct use in queries/DTO serialization.
// The main scorer in ./compute.ts uses the same logic, so this file is mainly
// for non-score contexts -- e.g. a read-time "should I render the 🔥 badge?"
// check without recomputing the full score.

import type { DealScoreInput } from "./types";
import { DEAL_SCORE_WEIGHTS, type DealScoreWeights } from "./weights";

/**
 * Returns true when the property meets every configured Hidden Gem threshold.
 * Mirrors the logic in computeDealScore so results stay consistent.
 */
export function isHiddenGem(
  input: Pick<
    DealScoreInput,
    "price" | "yieldPerMonth" | "markupPercentage" | "hasVehicle"
  >,
  weights: DealScoreWeights = DEAL_SCORE_WEIGHTS,
): boolean {
  const price = toNum(input.price);
  const yieldM = toNum(input.yieldPerMonth);
  const yieldRatio = price > 0 ? yieldM / price : 0;
  const vehicleOk = !weights.hiddenGem.requireVehicle || input.hasVehicle;
  const markupOk =
    (input.markupPercentage ?? Number.POSITIVE_INFINITY) <=
    weights.hiddenGem.maxMarkupPct;
  const yieldOk = yieldRatio >= weights.hiddenGem.minYieldRatio;
  return vehicleOk && markupOk && yieldOk;
}

function toNum(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
