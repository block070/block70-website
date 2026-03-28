import type { AIInsightDto } from "@/lib/api";

export const RECENT_INSIGHT_HOURS = 6;

export type InsightsViewerMode = "trader" | "investor" | "beginner";

export const INSIGHT_MODE_STORAGE_KEY = "b70-insights-mode";

export function isRecentInsight(
  createdAt: string | null | undefined,
  hours = RECENT_INSIGHT_HOURS,
): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < hours * 3600 * 1000;
}

const RISK_INSIGHT_TYPES = new Set([
  "narrative_shift",
  "opportunity_alert",
]);

const MACRO_INSIGHT_TYPES = new Set([
  "market_trend",
  "wallet_activity",
]);

export function isRiskBucketType(insightType: string): boolean {
  return RISK_INSIGHT_TYPES.has(insightType.toLowerCase());
}

export function isMacroBucketType(insightType: string): boolean {
  return MACRO_INSIGHT_TYPES.has(insightType.toLowerCase());
}

export function presentInsightTypeLabel(insightType: string): string {
  const t = insightType.toLowerCase();
  switch (t) {
    case "market_trend":
      return "Macro / trend";
    case "wallet_activity":
      return "Wallet & flow";
    case "narrative_shift":
      return "Narrative shift";
    case "opportunity_alert":
      return "Opportunity alert";
    default:
      return insightType.replace(/_/g, " ");
  }
}

export function reasoningPreamble(insightType: string): string {
  const t = insightType.toLowerCase();
  switch (t) {
    case "market_trend":
      return "Synthesized cross-asset context from aggregated platform signals.";
    case "wallet_activity":
      return "Informed by wallet- and flow-linked activity in Block70 data.";
    case "narrative_shift":
      return "Tracks narrative momentum changes vs prior windows.";
    case "opportunity_alert":
      return "Flags opportunity-shaped patterns from engine scoring—not an order recommendation.";
    default:
      return "Derived from Block70 AI insight pipeline.";
  }
}

export function sourceTypeLabel(sourceType: string): string {
  const s = sourceType.toLowerCase().replace(/_/g, " ");
  switch (s) {
    case "signals":
      return "Signals";
    case "wallet activity":
    case "wallet_activity":
      return "Wallet activity";
    case "radar events":
    case "radar_events":
      return "Radar";
    case "capital flows":
    case "capital_flows":
      return "Capital flows";
    default:
      return s || "Source";
  }
}

export function rollupSourceSummary(
  sources: { source_type: string; source_id: string }[] | undefined | null,
): string {
  if (!sources?.length) {
    return "No source lineage stored for this row—summary is model text only.";
  }
  const types = [...new Set(sources.map((s) => sourceTypeLabel(s.source_type)))];
  return `Aggregated from: ${types.join(", ")}.`;
}

export function modeHeroSubtitle(mode: InsightsViewerMode): string {
  switch (mode) {
    case "trader":
      return "Tilt toward alerts and high-confidence moves—still verify every thesis.";
    case "investor":
      return "Emphasizes macro trends and narrative shifts for longer horizon context.";
    default:
      return "Simplified framing—hover sections for what each block means. Not financial advice.";
  }
}

export function sortInsightsForMode(
  insights: AIInsightDto[],
  mode: InsightsViewerMode,
): AIInsightDto[] {
  const out = [...insights];
  const score = (i: AIInsightDto) => {
    let w = i.confidence_score ?? 0;
    const t = (i.insight_type ?? "").toLowerCase();
    if (mode === "trader") {
      if (t === "opportunity_alert") w += 0.15;
      if (t === "wallet_activity") w += 0.05;
    } else if (mode === "investor") {
      if (t === "market_trend") w += 0.12;
      if (t === "narrative_shift") w += 0.1;
    }
    return w;
  };
  out.sort((a, b) => {
    const tb = b.created_at ? Date.parse(b.created_at) || 0 : 0;
    const ta = a.created_at ? Date.parse(a.created_at) || 0 : 0;
    const sb = score(b);
    const sa = score(a);
    if (Math.abs(sb - sa) > 0.01) return sb - sa;
    return tb - ta;
  });
  return out;
}

/** Dedupe by type + title + related tokens; keep newest. */
export function dedupeInsights(items: AIInsightDto[]): AIInsightDto[] {
  const seen = new Map<string, { first: AIInsightDto; ts: number }>();
  for (const i of items) {
    const keyTokens = (i.related_tokens ?? []).slice().sort().join("|");
    const key = `${i.insight_type}::${i.title ?? ""}::${keyTokens}`;
    const ts = i.created_at ? Date.parse(i.created_at) || 0 : 0;
    const existing = seen.get(key);
    if (!existing || ts > existing.ts) {
      seen.set(key, { first: i, ts });
    }
  }
  return Array.from(seen.values())
    .map((v) => v.first)
    .sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) || 0 : 0;
      const tb = b.created_at ? Date.parse(b.created_at) || 0 : 0;
      return tb - ta;
    });
}
