import { NextResponse, type NextRequest } from "next/server";
import {
  hasUplandFeature,
  redactForTier,
  resolveUplandContext,
  upgradeRequired,
} from "@/lib/upland/entitlements";
import { parseFiltersFromSearchParams, filtersCanonicalKey } from "@/lib/upland/filters";
import { listProperties } from "@/lib/upland/queries";
import { getCached, hashFilterKey, setCached } from "@/lib/upland/cache";
import { checkUplandSearchRateLimit } from "@/lib/upland/rate-limit";
import type { PropertyListResponse } from "@/lib/upland/types";

export const runtime = "nodejs";
// Never statically cache this route -- auth + rate-limit state make it unsafe.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await resolveUplandContext(request);
  const parsed = parseFiltersFromSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: "bad_filters", detail: parsed.error }, { status: 400 });
  }
  const filters = parsed.filters;

  // -------- Entitlement gating --------
  // Premium filters require Pro.
  if (filters.hasVehicles !== undefined && !hasUplandFeature(ctx.tier, "upland_vehicle_filter")) {
    return upgradeRequired("upland_vehicle_filter");
  }
  if (filters.hiddenGem === true && !hasUplandFeature(ctx.tier, "upland_hidden_gems_feed")) {
    return upgradeRequired("upland_hidden_gems_feed");
  }
  const advancedFilterUsed =
    filters.minYield !== undefined ||
    filters.maxYield !== undefined ||
    filters.minMarkup !== undefined ||
    filters.maxMarkup !== undefined ||
    filters.minScore !== undefined ||
    filters.maxScore !== undefined ||
    filters.hasStructures !== undefined ||
    filters.neighborhood !== undefined ||
    filters.owner !== undefined;
  if (advancedFilterUsed && !hasUplandFeature(ctx.tier, "upland_advanced_filters")) {
    return upgradeRequired("upland_advanced_filters");
  }
  if (
    filters.sortBy &&
    !ctx.limits.allowedSortBy.includes(filters.sortBy)
  ) {
    return upgradeRequired(
      filters.sortBy === "deal" ? "upland_deal_score" : "upland_advanced_filters",
      { message: `Sort option "${filters.sortBy}" requires an upgrade.` },
    );
  }
  // Free tier caps: cities + page size.
  const cappedLimit = Math.min(filters.limit, ctx.limits.maxPageSize);
  if ((filters.city?.length ?? 0) > ctx.limits.maxCities) {
    return upgradeRequired("upland_advanced_filters", {
      message: `Free tier allows searching up to ${ctx.limits.maxCities} city at a time.`,
    });
  }

  // -------- Rate limit --------
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rl = await checkUplandSearchRateLimit({
    tier: ctx.tier,
    userId: ctx.userId,
    ip,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Daily search cap reached. Upgrade for a higher limit.",
        limit: rl.limit,
        count: rl.count,
        resetAt: rl.resetAt,
        upsellUrl: "/coins/upland/pricing?upsell=upland_basic_search",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": rl.resetAt,
        },
      },
    );
  }

  // -------- Cache --------
  const cacheableFilters = { ...filters, limit: cappedLimit };
  const cacheKey = hashFilterKey(
    `${ctx.tier}:${filtersCanonicalKey(cacheableFilters)}`,
  );
  const cached = await getCached<PropertyListResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: ratelimitHeaders(rl),
    });
  }

  try {
    const response = await listProperties(cacheableFilters);
    // Redact premium fields for free-tier viewers. We still load them from the
    // view (it's the same index either way); redaction happens after the query.
    const redactedItems = response.items.map((r) => redactForTier(r, ctx.tier));
    const payload: PropertyListResponse = {
      ...response,
      items: redactedItems,
      freeTierCap:
        ctx.tier === "free"
          ? {
              feature: "upland_advanced_filters",
              message: "Pro unlocks deal score, vehicle filter, and advanced sort options.",
              upsellUrl: "/coins/upland/pricing",
            }
          : undefined,
    };
    await setCached(cacheKey, payload, 30);
    return NextResponse.json(payload, { headers: ratelimitHeaders(rl) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: "query_failed", detail: msg }, { status: 500 });
  }
}

function ratelimitHeaders(rl: { limit: number; remaining: number; resetAt: string }): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": rl.resetAt,
  };
}
