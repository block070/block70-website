import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const dynamic = "force-dynamic";

/**
 * Proxies narrative trending opportunities from FastAPI (same pattern as /api/v1/airdrops).
 * Required when `resolveNarrativesIntelligence` uses the www origin: synthetic fallbacks
 * GET this path on the site host.
 */
export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit") ?? "100";
  const limit = Math.min(200, Math.max(1, Number(limitParam) || 100));

  if (API_BASE) {
    const base = API_BASE.replace(/\/$/, "");
    try {
      const upstream = await fetch(
        `${base}/api/v1/narratives/trending?limit=${encodeURIComponent(String(limit))}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(25_000),
        },
      );
      if (upstream.ok) {
        const data = await upstream.json();
        return NextResponse.json(data);
      }
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json([]);
}
