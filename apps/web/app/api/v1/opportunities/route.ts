import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const dynamic = "force-dynamic";

/**
 * Proxies GET /api/v1/opportunities (query preserved) for narrative synthetic fallbacks
 * and other callers using same-origin paths.
 */
export async function GET(req: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json([]);
  }

  const base = API_BASE.replace(/\/$/, "");
  const q = req.nextUrl.searchParams.toString();
  const path = q
    ? `${base}/api/v1/opportunities?${q}`
    : `${base}/api/v1/opportunities`;

  try {
    const upstream = await fetch(path, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    if (upstream.ok) {
      const data = await upstream.json();
      return NextResponse.json(data);
    }
  } catch {
    /* fall through */
  }

  return NextResponse.json([]);
}
