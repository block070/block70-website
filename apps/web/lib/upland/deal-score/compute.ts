// Pure Deal Score computation. No I/O, no Prisma, no Decimal.js dep --
// callers hand off money columns as string | number | null and we normalize.
//
// Invariants:
//   * Score in [0, weights.max], rounded to 2dp.
//   * Undervaluation factor clamped to [-weight, weight] so outlandish markups
//     (e.g. 1000%) can't swamp the total.
//   * cityMultiplierDelta in the breakdown is for UI transparency only and
//     is already baked into `score` via rawSum * cityMultiplier.
//   * HiddenGem predicate: vehicle required (if configured), markup <= max,
//     yieldRatio >= min. Returns human-readable reasons for badge tooltips.

import type {
  DealScoreBreakdown,
  DealScoreInput,
  DealScoreMoney,
  DealScoreResult,
} from "./types";
import { DEAL_SCORE_WEIGHTS, type DealScoreWeights } from "./weights";

function toFiniteNumber(value: DealScoreMoney): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function computeDealScore(
  input: DealScoreInput,
  weights: DealScoreWeights = DEAL_SCORE_WEIGHTS,
): DealScoreResult {
  const b: DealScoreBreakdown = {
    undervaluation: 0,
    yieldEfficiency: 0,
    vehicle: 0,
    structure: 0,
    liquidity: 0,
    rarity: 0,
    cityMultiplierDelta: 0,
  };

  // 1. Undervaluation -- reward low markup, penalize high markup.
  //    markup=0   -> normalized=1  (max reward)
  //    markup=50  -> normalized=0.5
  //    markup=100 -> normalized=0  (neutral)
  //    markup>200 -> clamped to -1 (max penalty)
  if (input.markupPercentage != null) {
    const normalized = clamp(1 - input.markupPercentage / 100, -1, 1);
    b.undervaluation = normalized * weights.undervaluationWeight;
  }

  // 2. Yield efficiency -- monthly yield / price, saturating at normalizer.
  const price = toFiniteNumber(input.price);
  const yieldM = toFiniteNumber(input.yieldPerMonth);
  const yieldRatio = price > 0 ? yieldM / price : 0;
  b.yieldEfficiency =
    clamp(yieldRatio * weights.yieldEfficiencyNormalizer, 0, 1) *
    weights.yieldEfficiencyWeight;

  // 3. Vehicle bonus.
  if (input.hasVehicle) {
    const extras = Math.max(0, input.vehicleCount - 1) * weights.vehiclePerExtra;
    b.vehicle = Math.min(weights.vehicleCap, weights.vehicleBase + extras);
  }

  // 4. Structure bonus -- flat.
  if (input.hasStructure) b.structure = weights.structureBonus;

  // 5. Market liquidity -- you can act on this row today.
  if (input.forSale) b.liquidity = weights.forSaleBonus;

  // 6. Rarity overlays.
  if (input.collection) {
    b.rarity += weights.collectionBonuses[input.collection] ?? 0;
  }
  if (input.neighborhood) {
    b.rarity += weights.neighborhoodBonuses[input.neighborhood] ?? 0;
  }

  const rawSum =
    b.undervaluation +
    b.yieldEfficiency +
    b.vehicle +
    b.structure +
    b.liquidity +
    b.rarity;

  // 7. City demand multiplier. Reported as delta in the breakdown for UI.
  const cityMultiplier =
    weights.cityDemandOverrides[input.city] ?? weights.cityDemandDefault;
  b.cityMultiplierDelta = rawSum * (cityMultiplier - 1);
  const adjusted = rawSum * cityMultiplier;

  const score = Number(clamp(adjusted, 0, weights.max).toFixed(2));

  // Hidden Gem detection.
  const reasons: string[] = [];
  const needsVehicle = weights.hiddenGem.requireVehicle;
  const vehicleOk = !needsVehicle || input.hasVehicle;
  const markupOk =
    (input.markupPercentage ?? Number.POSITIVE_INFINITY) <=
    weights.hiddenGem.maxMarkupPct;
  const yieldOk = yieldRatio >= weights.hiddenGem.minYieldRatio;
  if (vehicleOk && markupOk && yieldOk) {
    if (input.hasVehicle) reasons.push("Includes vehicle");
    if (input.markupPercentage != null) {
      reasons.push(`Low markup (${input.markupPercentage.toFixed(1)}%)`);
    }
    reasons.push(`Strong yield (${(yieldRatio * 100).toFixed(3)}%/mo)`);
  }

  return {
    score,
    rawSum,
    cityMultiplier,
    breakdown: b,
    isHiddenGem: reasons.length > 0,
    hiddenGemReasons: reasons,
    weightsVersion: weights.version,
  };
}
