/** Plan ladder and feature gates (keep in sync with `app/core/plan_access.py`). */

export const PLAN_ORDER: Record<string, number> = {
  free: 0,
  pro: 1,
  elite: 2,
  quant: 3,
  admin: 99,
};

export function normalizePlan(plan: string | undefined | null): string {
  const p = (plan ?? "free").toLowerCase().trim();
  if (p === "admin") return "admin";
  if (p in PLAN_ORDER && p !== "admin") return p;
  return "free";
}

/** Mirrors backend `effective_plan` trial window for client-side paywalls. */
export function effectivePlanForGating(
  planType: string | undefined | null,
  trialEndIso: string | null | undefined,
): string {
  const base = normalizePlan(planType);
  if (base === "admin") return "admin";
  if (trialEndIso) {
    const t = Date.parse(trialEndIso);
    if (!Number.isNaN(t) && t > Date.now()) return "elite";
  }
  return base;
}

export function hasPlanAccess(
  userPlan: string | undefined | null,
  minPlan: string,
): boolean {
  const u = normalizePlan(userPlan);
  if (u === "admin") return true;
  return (PLAN_ORDER[u] ?? 0) >= (PLAN_ORDER[normalizePlan(minPlan)] ?? 0);
}

const FEATURES: Record<string, string[]> = {
  opportunities_full: ["elite", "quant"],
  signals_medium: ["pro", "elite", "quant"],
  signals_high: ["elite", "quant"],
  ai_full: ["pro", "elite", "quant"],
  api_access: ["quant"],
};

export function hasFeature(
  userPlan: string | undefined | null,
  feature: keyof typeof FEATURES,
): boolean {
  const u = normalizePlan(userPlan);
  if (u === "admin") return true;
  return FEATURES[feature]?.includes(u) ?? false;
}

export type SignalsFeedTier = "low" | "medium" | "high";

/** Aligns with API feed policy: free=low, pro=medium, elite/quant=high. */
export function signalsFeedTier(
  userPlan: string | undefined | null,
): SignalsFeedTier {
  if (hasFeature(userPlan, "signals_high")) return "high";
  if (hasFeature(userPlan, "signals_medium")) return "medium";
  return "low";
}

/** `block70_plan` cookie / auth values that unlock paid market data UX. */
export function isPaidBlock70Plan(plan: string | undefined | null): boolean {
  const p = normalizePlan(plan);
  return p === "pro" || p === "elite" || p === "quant" || p === "admin";
}
