// Golden fixture tests for the Deal Score algorithm.
//
// Every row below mirrors the Example scored dataset in the plan
// (upland-property-search_d2bc1f4a.plan.md -> "Example scored dataset"). If a
// weight bump changes any of these numbers, either the plan's dataset section
// or the default weight bundle should be updated -- never silently both.
//
// Running: `npx vitest run` from apps/web (vitest config is shared with other
// test files; if none exists yet, `npx tsx --test` also works for a quick
// smoke check because we only rely on node:assert).

import { describe, expect, it } from "vitest";
import { computeDealScore } from "../compute";
import { DEAL_SCORE_WEIGHTS } from "../weights";

describe("computeDealScore — Example scored dataset", () => {
  it("Row A — 112 Market St, San Francisco (high demand, 20% markup, 1 vehicle, structure)", () => {
    const result = computeDealScore({
      price: 1200,
      mintPrice: 1000,
      markupPercentage: 20,
      yieldPerMonth: 5,
      forSale: true,
      hasVehicle: true,
      vehicleCount: 1,
      hasStructure: true,
      city: "San Francisco",
      collection: null,
      neighborhood: null,
    });
    expect(result.breakdown.undervaluation).toBeCloseTo(24, 5);
    expect(result.breakdown.yieldEfficiency).toBeCloseTo(30, 5);
    expect(result.breakdown.vehicle).toBe(20);
    expect(result.breakdown.structure).toBe(10);
    expect(result.breakdown.liquidity).toBe(5);
    expect(result.breakdown.rarity).toBe(0);
    expect(result.rawSum).toBeCloseTo(89, 5);
    expect(result.cityMultiplier).toBeCloseTo(1.12, 5);
    expect(result.score).toBeCloseTo(99.68, 2);
    expect(result.isHiddenGem).toBe(false); // markup 20% > threshold 10%
  });

  it("Row B — 9 Elm, Detroit (low-demand city, low markup, 3 vehicles)", () => {
    const result = computeDealScore({
      price: 300,
      mintPrice: 280,
      markupPercentage: (300 - 280) / 280 * 100, // ≈ 7.142857
      yieldPerMonth: 0.4,
      forSale: true,
      hasVehicle: true,
      vehicleCount: 3,
      hasStructure: false,
      city: "Detroit",
      collection: null,
      neighborhood: null,
    });
    expect(result.breakdown.undervaluation).toBeCloseTo(27.857, 2);
    expect(result.breakdown.yieldEfficiency).toBeCloseTo(30, 5);
    expect(result.breakdown.vehicle).toBe(30); // 20 + 2*5
    expect(result.breakdown.structure).toBe(0);
    expect(result.breakdown.liquidity).toBe(5);
    expect(result.rawSum).toBeCloseTo(92.857, 2);
    expect(result.cityMultiplier).toBeCloseTo(0.9, 5);
    expect(result.score).toBeCloseTo(83.57, 1);
    expect(result.isHiddenGem).toBe(true);
    expect(result.hiddenGemReasons).toContain("Includes vehicle");
  });

  it("Row C — 501 Broadway, New York (300% markup penalty, not for sale)", () => {
    const result = computeDealScore({
      price: 8000,
      mintPrice: 2000,
      markupPercentage: 300,
      yieldPerMonth: 40,
      forSale: false,
      hasVehicle: false,
      vehicleCount: 0,
      hasStructure: true,
      city: "New York",
      collection: null,
      neighborhood: null,
    });
    // 1 - 300/100 = -2, clamped to -1 -> -1 * 30 = -30
    expect(result.breakdown.undervaluation).toBe(-30);
    expect(result.breakdown.yieldEfficiency).toBeCloseTo(30, 5);
    expect(result.breakdown.vehicle).toBe(0);
    expect(result.breakdown.structure).toBe(10);
    expect(result.breakdown.liquidity).toBe(0);
    expect(result.rawSum).toBeCloseTo(10, 5);
    expect(result.cityMultiplier).toBeCloseTo(1.1, 5);
    expect(result.score).toBeCloseTo(11, 2);
    expect(result.isHiddenGem).toBe(false);
  });

  it("Row D — 82 Park Ave, Brooklyn (low markup, no vehicle, sensible buy)", () => {
    const markup = (450 - 440) / 440 * 100; // ≈ 2.272727
    const result = computeDealScore({
      price: 450,
      mintPrice: 440,
      markupPercentage: markup,
      yieldPerMonth: 1.1,
      forSale: true,
      hasVehicle: false,
      vehicleCount: 0,
      hasStructure: false,
      city: "Brooklyn",
      collection: null,
      neighborhood: null,
    });
    expect(result.breakdown.undervaluation).toBeCloseTo(29.32, 1);
    expect(result.breakdown.yieldEfficiency).toBeCloseTo(30, 5);
    expect(result.breakdown.vehicle).toBe(0);
    expect(result.breakdown.liquidity).toBe(5);
    expect(result.rawSum).toBeCloseTo(64.32, 1);
    expect(result.cityMultiplier).toBeCloseTo(1.15, 5);
    expect(result.score).toBeCloseTo(73.97, 1);
    expect(result.isHiddenGem).toBe(false); // requireVehicle
  });

  it("Row E — 77 Ocean, Oakland (not for sale, 0% markup, low yield, 1 vehicle)", () => {
    const result = computeDealScore({
      price: 600,
      mintPrice: 600,
      markupPercentage: 0,
      yieldPerMonth: 0.2,
      forSale: false,
      hasVehicle: true,
      vehicleCount: 1,
      hasStructure: false,
      city: "Oakland",
      collection: null,
      neighborhood: null,
    });
    expect(result.breakdown.undervaluation).toBe(30);
    expect(result.breakdown.yieldEfficiency).toBeCloseTo(10, 5);
    expect(result.breakdown.vehicle).toBe(20);
    expect(result.breakdown.liquidity).toBe(0);
    expect(result.rawSum).toBeCloseTo(60, 5);
    expect(result.cityMultiplier).toBeCloseTo(0.95, 5);
    expect(result.score).toBeCloseTo(57, 2);
    // yieldRatio = 0.2/600 ≈ 0.000333 < 0.0005 -> fails yield threshold.
    expect(result.isHiddenGem).toBe(false);
  });
});

describe("computeDealScore — edge cases", () => {
  it("handles null price without dividing by zero", () => {
    const result = computeDealScore({
      price: null,
      mintPrice: null,
      markupPercentage: null,
      yieldPerMonth: null,
      forSale: false,
      hasVehicle: false,
      vehicleCount: 0,
      hasStructure: false,
      city: "Nowhereville",
      collection: null,
      neighborhood: null,
    });
    expect(result.score).toBe(0);
    expect(result.rawSum).toBe(0);
    expect(result.cityMultiplier).toBe(DEAL_SCORE_WEIGHTS.cityDemandDefault);
  });

  it("clamps final score at weights.max regardless of raw sum", () => {
    // Synthesize a row that would exceed 100 before clamping.
    const result = computeDealScore({
      price: 100,
      mintPrice: 100,
      markupPercentage: -50, // negative markup => undervaluation normalized to 1 (clamp)
      yieldPerMonth: 10, // yieldRatio = 0.1 -> saturates
      forSale: true,
      hasVehicle: true,
      vehicleCount: 10,
      hasStructure: true,
      city: "Brooklyn",
      collection: null,
      neighborhood: null,
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBe(100);
  });

  it("caps vehicle contribution at vehicleCap", () => {
    const result = computeDealScore({
      price: 1000,
      mintPrice: 1000,
      markupPercentage: 0,
      yieldPerMonth: 0,
      forSale: false,
      hasVehicle: true,
      vehicleCount: 50, // would otherwise be 20 + 49*5 = 265
      hasStructure: false,
      city: "San Francisco",
      collection: null,
      neighborhood: null,
    });
    expect(result.breakdown.vehicle).toBe(DEAL_SCORE_WEIGHTS.vehicleCap);
  });

  it("applies cityDemandDefault for unknown cities", () => {
    const result = computeDealScore({
      price: 1000,
      mintPrice: 1000,
      markupPercentage: 0,
      yieldPerMonth: 1,
      forSale: true,
      hasVehicle: false,
      vehicleCount: 0,
      hasStructure: false,
      city: "Somewhere-Not-In-Overrides",
      collection: null,
      neighborhood: null,
    });
    expect(result.cityMultiplier).toBe(DEAL_SCORE_WEIGHTS.cityDemandDefault);
  });
});
