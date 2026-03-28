import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limitRaw = req.nextUrl.searchParams.get("limit") ?? "50";
  const limit = Math.min(200, Math.max(1, Number(limitRaw) || 50));

  if (API_BASE) {
    const base = API_BASE.replace(/\/$/, "");
    try {
      const upstream = await fetch(
        `${base}/api/v1/narratives/intelligence?limit=${encodeURIComponent(String(limit))}`,
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
      /* fall through */
    }
  }

  return NextResponse.json({
    narratives: [],
    computed_at: new Date().toISOString(),
  });
}
