// Deal Score input, breakdown, and result contracts.
//
// The scorer is a pure function over these types so that it can be unit-tested
// in isolation from Prisma, the ingestion layer, and HTTP. The Example scored
// dataset in docs/upland-property-search.md (and the plan) is the canonical
// test fixture.

/**
 * Monetary inputs are accepted as strings, numbers, or null so callers can hand
 * off Prisma Decimal columns without coercion at every callsite. Internally the
 * compute function normalizes everything to a finite number or 0.
 */
export type DealScoreMoney = number | string | null | undefined;

export type DealScoreInput = {
  price: DealScoreMoney;
  mintPrice: DealScoreMoney;
  markupPercentage: number | null;
  yieldPerMonth: DealScoreMoney;
  forSale: boolean;
  hasVehicle: boolean;
  vehicleCount: number;
  hasStructure: boolean;
  city: string;
  collection: string | null;
  neighborhood: string | null;
};

export type DealScoreBreakdown = {
  undervaluation: number;
  yieldEfficiency: number;
  vehicle: number;
  structure: number;
  liquidity: number;
  rarity: number;
  /** Points added (or subtracted) by the city demand multiplier. */
  cityMultiplierDelta: number;
};

export type DealScoreResult = {
  /** Final score, clamped to [0, weights.max] and rounded to 2 decimal places. */
  score: number;
  /** Pre-multiplier sum of all factor contributions. */
  rawSum: number;
  /** City multiplier actually applied. */
  cityMultiplier: number;
  breakdown: DealScoreBreakdown;
  isHiddenGem: boolean;
  hiddenGemReasons: string[];
  weightsVersion: number;
};
