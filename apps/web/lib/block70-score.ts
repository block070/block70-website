/**
 * Block70 composite score: `total_score` from API is typically 0–1; display as 0–100.
 */

export type Block70ScoreTier = "rare" | "strong" | "developing";

/** Convert stored total_score to 0–100 for display (handles values already in 0–100). */
export function scoreToPercent(totalScore: number | null | undefined): number {
  if (totalScore == null || !Number.isFinite(totalScore)) return 0;
  if (totalScore <= 1) return Math.round(Math.min(100, Math.max(0, totalScore * 100)));
  return Math.round(Math.min(100, Math.max(0, totalScore)));
}

const RARE_MIN = 90;
const STRONG_MIN = 80;

export function scoreTier(percent: number): Block70ScoreTier {
  if (percent >= RARE_MIN) return "rare";
  if (percent >= STRONG_MIN) return "strong";
  return "developing";
}

export function tierLabel(tier: Block70ScoreTier): string {
  switch (tier) {
    case "rare":
      return "Rare opportunity";
    case "strong":
      return "Strong setup";
    default:
      return "Developing";
  }
}

/** UI tone for Block70 score badges (green / grey / red) from 0–100 display percent. */
export function scoreMarketTone(percent: number): "bullish" | "bearish" | "neutral" {
  if (percent >= 68) return "bullish";
  if (percent <= 42) return "bearish";
  return "neutral";
}

/** Factor 0–1 → display percent for breakdown rows */
export function factorPercent(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return 0;
  if (v <= 1) return Math.round(v * 100);
  return Math.round(Math.min(100, Math.max(0, v)));
}
