// POST /api/upland/deal-score/recompute
//
// Admin/ops endpoint that recomputes deal scores for every property whose
// stored version is behind the current weights.version. Guarded by
// UPLAND_DEAL_SCORE_SECRET so the n8n drift-guard node can call it without
// a user JWT.

import { NextResponse, type NextRequest } from "next/server";
import { uplandPrisma } from "@/lib/upland/db";
import { recomputeDealScores } from "@/lib/upland/deal-score/recompute";
import { DEAL_SCORE_WEIGHTS } from "@/lib/upland/deal-score";
import { invalidateUplandCache } from "@/lib/upland/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.UPLAND_DEAL_SCORE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "not_configured", detail: "UPLAND_DEAL_SCORE_SECRET is unset" },
      { status: 500 },
    );
  }
  if (request.headers.get("x-upland-deal-score-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // empty body is fine
  }

  const limit = typeof body.limit === "number" ? (body.limit as number) : undefined;
  const pageSize = typeof body.pageSize === "number" ? (body.pageSize as number) : undefined;
  const onlyNullScore = body.onlyNullScore === true;

  try {
    const stats = await recomputeDealScores(
      uplandPrisma,
      { limit, pageSize, onlyNullScore },
      DEAL_SCORE_WEIGHTS,
    );

    // If anything was updated, the materialized view is stale until the next
    // ingestion run. Refresh it eagerly so the UI sees new scores immediately.
    if (stats.updated > 0) {
      await uplandPrisma.$executeRawUnsafe(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY property_search_view",
      );
      await invalidateUplandCache();
    }

    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "recompute_failed";
    return NextResponse.json({ error: "recompute_failed", detail: msg }, { status: 500 });
  }
}
