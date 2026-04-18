import { NextResponse, type NextRequest } from "next/server";
import { resolveUplandContext } from "@/lib/upland/entitlements";
import { listCities } from "@/lib/upland/queries";

export const runtime = "nodejs";
// Cities facet is safe to cache for a few minutes -- city_stats_view only
// changes when a new city is ingested.
export const revalidate = 300;

export async function GET(request: NextRequest) {
  await resolveUplandContext(request); // parity: still resolve for rate-limit + logs
  try {
    const cities = await listCities();
    return NextResponse.json(
      { cities },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: "query_failed", detail: msg }, { status: 500 });
  }
}
