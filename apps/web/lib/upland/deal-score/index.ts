// Barrel export for the Deal Score library. Keeps downstream imports tidy:
//
//   import { computeDealScore, DEAL_SCORE_WEIGHTS } from "@/lib/upland/deal-score";

export { computeDealScore } from "./compute";
export { isHiddenGem } from "./hidden-gem";
export {
  resolveCityMultiplier,
  deriveCityMultipliersFromStats,
} from "./city-demand";
export {
  DEAL_SCORE_WEIGHTS,
  mergeWeights,
  type DealScoreWeights,
  type DealScoreWeightsOverride,
} from "./weights";
export type {
  DealScoreInput,
  DealScoreBreakdown,
  DealScoreResult,
  DealScoreMoney,
} from "./types";
