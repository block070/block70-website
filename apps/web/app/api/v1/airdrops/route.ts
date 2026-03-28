import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const dynamic = "force-dynamic";

/**
 * Proxies to the Python API when env is set; otherwise returns [] so SSR/client
 * relative `/api/v1/airdrops` resolves (avoids 404 when Next has no backend URL on server).
 */
export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit") ?? "200";
  const limit = Math.min(500, Math.max(1, Number(limitParam) || 200));

  if (API_BASE) {
    const base = API_BASE.replace(/\/$/, "");
    try {
      const upstream = await fetch(
        `${base}/api/v1/airdrops?limit=${encodeURIComponent(String(limit))}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
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
