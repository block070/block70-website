import { NextRequest, NextResponse } from "next/server";
import { loadCoinsPageData } from "@/lib/market/load-coins-page-data";

const CACHE_REV = 45;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") ?? "100", 10) || 100));
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);

  try {
    const body = await loadCoinsPageData({ limit, offset });
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_REV}, stale-while-revalidate=${CACHE_REV * 2}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "coins fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
