// Default weight bundle for the Deal Score algorithm.
//
// Versioning contract:
//   * Bumping `version` flags every existing properties.deal_score_version row
//     as stale. The n8n drift-guard node then triggers the recompute endpoint.
//   * Weights are `as const` so TypeScript surfaces accidental mutation as an
//     error rather than silently corrupting scores at runtime.
//
// Tuning strategy:
//   * Edit this file to ship a new bundle (always bump `version`).
//   * Or point `UPLAND_DEAL_SCORE_WEIGHTS_PATH` at a JSON file on the host to
//     override at process start without redeploying. The loader in
//     ./weights-loader deep-merges overrides on top of this bundle and validates.

export const DEAL_SCORE_WEIGHTS = {
  version: 1,

  // Factor weights (points contributed to rawSum before city multiplier).
  undervaluationWeight: 30,
  yieldEfficiencyWeight: 30,
  /**
   * yieldRatio = yieldPerMonth / price.
   * yieldRatio * yieldEfficiencyNormalizer is clamped to [0, 1] and then
   * multiplied by yieldEfficiencyWeight. Default normalizer = 1000 means the
   * weight fully saturates at yieldRatio >= 0.001 (0.1% / month).
   */
  yieldEfficiencyNormalizer: 1000,

  // Vehicle bonus — the product's signature factor.
  vehicleBase: 20,
  vehiclePerExtra: 5,
  vehicleCap: 40,

  // Secondary bonuses.
  structureBonus: 10,
  forSaleBonus: 5,

  // City demand multiplier. Static overrides; fallback to default.
  cityDemandDefault: 1.0,
  cityDemandOverrides: {
    "Brooklyn": 1.15,
    "San Francisco": 1.12,
    "New York": 1.1,
    "Manhattan": 1.1,
    "Chicago": 1.05,
    "Oakland": 0.95,
    "Detroit": 0.9,
  } as Record<string, number>,

  // Optional rarity bonuses (flat points).
  collectionBonuses: {} as Record<string, number>,
  neighborhoodBonuses: {} as Record<string, number>,

  // Hidden Gem predicate thresholds.
  hiddenGem: {
    requireVehicle: true,
    /** Markup must be at or below this percentage (inclusive). */
    maxMarkupPct: 10,
    /** Monthly yield / price must be at or above this ratio (inclusive). */
    minYieldRatio: 0.0005,
  },

  /** Hard ceiling after the city multiplier. */
  max: 100,
} as const;

export type DealScoreWeights = typeof DEAL_SCORE_WEIGHTS;

// A "mutable" shape for runtime overrides. We deep-merge onto this so consumer
// code can override nested fields (e.g. hiddenGem.maxMarkupPct) without having
// to redeclare the whole bundle.
export type DealScoreWeightsOverride = {
  version?: number;
  undervaluationWeight?: number;
  yieldEfficiencyWeight?: number;
  yieldEfficiencyNormalizer?: number;
  vehicleBase?: number;
  vehiclePerExtra?: number;
  vehicleCap?: number;
  structureBonus?: number;
  forSaleBonus?: number;
  cityDemandDefault?: number;
  cityDemandOverrides?: Record<string, number>;
  collectionBonuses?: Record<string, number>;
  neighborhoodBonuses?: Record<string, number>;
  hiddenGem?: {
    requireVehicle?: boolean;
    maxMarkupPct?: number;
    minYieldRatio?: number;
  };
  max?: number;
};

export function mergeWeights(
  base: DealScoreWeights,
  override: DealScoreWeightsOverride | null | undefined,
): DealScoreWeights {
  if (!override) return base;
  // Deep-merge; the cast back to DealScoreWeights is safe because `as const`
  // is a compile-time annotation and we preserve every required field.
  return {
    ...base,
    ...override,
    cityDemandOverrides: {
      ...base.cityDemandOverrides,
      ...(override.cityDemandOverrides ?? {}),
    },
    collectionBonuses: {
      ...base.collectionBonuses,
      ...(override.collectionBonuses ?? {}),
    },
    neighborhoodBonuses: {
      ...base.neighborhoodBonuses,
      ...(override.neighborhoodBonuses ?? {}),
    },
    hiddenGem: {
      ...base.hiddenGem,
      ...(override.hiddenGem ?? {}),
    },
  } as DealScoreWeights;
}
