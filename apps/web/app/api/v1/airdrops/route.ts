import { NextRequest, NextResponse } from "next/server";

import { backendGet, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

/**
 * Proxies to FastAPI using the same backend base + TLS fallback as narratives.
 * Returns [] when no base is configured or upstream fails.
 */
export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit") ?? "200";
  const limit = Math.min(500, Math.max(1, Number(limitParam) || 200));

  const base = getBackendApiBase();
  if (base) {
    try {
      const upstream = await backendGet(
        `${base.replace(/\/$/, "")}/api/v1/airdrops?limit=${encodeURIComponent(String(limit))}`,
      );
      if (upstream.ok) {
        const data = await upstream.json();
        return NextResponse.json(data);
      }
    } catch {
      /* fall through to empty */
    }
  }

  return NextResponse.json([]);
}
