import { NextRequest, NextResponse } from "next/server";

import { fetchAirdropsUpstream } from "@/lib/airdrops-upstream";

export const dynamic = "force-dynamic";

/**
 * JSON list from FastAPI (same path as SSR). Returns [] when no backend base or upstream fails.
 */
export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit") ?? "200";
  const limit = Math.min(500, Math.max(1, Number(limitParam) || 200));

  const data = await fetchAirdropsUpstream(limit);
  return NextResponse.json(data);
}
