// TypeScript mirror of the Upland feature matrix + helpers.
//
// SOURCE OF TRUTH: ./feature-matrix.json. The Python side
// (apps/api/app/services/upland/entitlements.py) loads the same JSON. A parity
// test guarantees both sides stay aligned.
//
// Key helpers:
//   * uplandTier(user)       -> 'free' | 'pro' | 'elite' (respects global quant/admin)
//   * hasUplandFeature(...)  -> boolean check
//   * uplandLimits(tier)     -> the limit bundle for the tier
//   * resolveUplandContext(request) -> full context (tier, features, limits)
//     used by every /api/upland/* route before it touches Prisma.
//   * upgradeRequired(feature, request?) -> 402 helper

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import matrixJson from "./feature-matrix.json";

export type UplandTier = "free" | "pro" | "elite";

export type UplandFeature =
  | "upland_basic_search"
  | "upland_deal_score"
  | "upland_vehicle_filter"
  | "upland_hidden_gems_feed"
  | "upland_advanced_filters"
  | "upland_saved_searches"
  | "upland_realtime_alerts"
  | "upland_api_access"
  | "upland_portfolio_tracking"
  | "upland_early_access_data";

export type UplandLimits = {
  maxPageSize: number;
  maxPageIndex: number;
  maxCities: number;
  allowedSortBy: string[];
  dailySearchCap: number;
  anonDailySearchCap?: number;
  savedSearchesMax: number;
  apiRateLimitPerMin: number;
};

type MatrixShape = {
  version: number;
  features: Record<string, string[]>;
  limits: Record<UplandTier, UplandLimits>;
};

const MATRIX = matrixJson as unknown as MatrixShape;

export const FEATURE_MATRIX_VERSION: number = MATRIX.version;

export function uplandTier(args: {
  globalPlan?: string | null;
  role?: string | null;
  uplandTierClaim?: string | null;
}): UplandTier {
  const role = (args.role ?? "").toLowerCase();
  if (role === "admin") return "elite";

  const globalPlan = (args.globalPlan ?? "free").toLowerCase();
  if (globalPlan === "quant" || globalPlan === "admin") return "elite";

  const claim = (args.uplandTierClaim ?? "").toLowerCase();
  if (claim === "elite" || claim === "pro") return claim;

  return "free";
}

export function hasUplandFeature(tier: UplandTier, feature: UplandFeature): boolean {
  const allowed = MATRIX.features[feature];
  if (!Array.isArray(allowed)) return false;
  return allowed.includes(tier);
}

export function uplandLimits(tier: UplandTier): UplandLimits {
  return MATRIX.limits[tier];
}

export function featuresForTier(tier: UplandTier): UplandFeature[] {
  return (Object.keys(MATRIX.features) as UplandFeature[]).filter((f) =>
    hasUplandFeature(tier, f),
  );
}

// -----------------------------------------------------------------------------
// Request context
// -----------------------------------------------------------------------------

export type UplandContext = {
  tier: UplandTier;
  features: Set<UplandFeature>;
  limits: UplandLimits;
  /** User id from the auth session, or null for anonymous. */
  userId: number | null;
  /** Raw JWT, if we have one. Used by resolveUplandContext to call FastAPI. */
  token: string | null;
};

type EntitlementsResponse = {
  tier: UplandTier;
  features: UplandFeature[];
  limits: UplandLimits;
  user_id: number | null;
};

/**
 * Resolve the full entitlement context for an incoming request. Safe to call
 * from any /api/upland/* route or server component.
 *
 * Strategy:
 *   1. Read the `block70_session` cookie (existing JWT).
 *   2. If present, fetch `/api/v1/upland/entitlements` from FastAPI with a
 *      30s revalidate window -- that endpoint is the source of truth and
 *      resolves both product_entitlements and the global-plan override.
 *   3. If missing or FastAPI is unreachable, degrade to the Free tier.
 *
 * The `upland_tier` JWT claim is a hint for edge middleware only; the real
 * check happens here server-side.
 */
export async function resolveUplandContext(
  request?: NextRequest,
): Promise<UplandContext> {
  const token = await readSessionToken(request);
  let tier: UplandTier = "free";
  let userId: number | null = null;

  if (token) {
    const apiBase =
      process.env.BLOCK70_INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    try {
      const res = await fetch(`${apiBase}/api/v1/upland/entitlements`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const data = (await res.json()) as EntitlementsResponse;
        tier = data.tier ?? "free";
        userId = data.user_id ?? null;
      }
    } catch {
      // FastAPI unreachable: fall through to Free tier so the page degrades
      // rather than 500ing.
    }
  }

  return {
    tier,
    features: new Set(featuresForTier(tier)),
    limits: uplandLimits(tier),
    userId,
    token,
  };
}

async function readSessionToken(
  request?: NextRequest,
): Promise<string | null> {
  if (request) {
    const fromReq = request.cookies.get("block70_session")?.value;
    if (fromReq) return fromReq;
  }
  try {
    // `cookies()` works in server components and route handlers; in legacy
    // contexts it's async in Next 15 but synchronous in Next 14.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = cookies();
    const v = typeof c.get === "function" ? c.get("block70_session")?.value : null;
    return v ?? null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// 402 helper + response-shape redaction
// -----------------------------------------------------------------------------

export function upgradeRequired(
  feature: UplandFeature,
  opts: { message?: string } = {},
): NextResponse {
  const body = {
    error: "upgrade_required",
    feature,
    message:
      opts.message ??
      `This filter or sort option requires an Upland Pro or Elite subscription.`,
    upsellUrl: `/coins/upland/pricing?upsell=${feature}`,
  };
  return NextResponse.json(body, { status: 402 });
}

export function redactForTier<
  T extends {
    dealScore?: number | null;
    isHiddenGem?: boolean;
    markupPercentage?: number | null;
    yieldPerMonth?: number | null;
    dealScoreBreakdown?: unknown;
    dealScoreReasons?: unknown;
  },
>(row: T, tier: UplandTier): T {
  if (tier === "free") {
    return {
      ...row,
      dealScore: null,
      isHiddenGem: false,
      markupPercentage: null,
      yieldPerMonth: null,
      dealScoreBreakdown: undefined,
      dealScoreReasons: undefined,
    };
  }
  return row;
}

export const UPLAND_FEATURE_KEYS: UplandFeature[] = Object.keys(
  MATRIX.features,
) as UplandFeature[];
