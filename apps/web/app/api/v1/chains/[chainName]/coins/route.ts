import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chainName: string }> | { chainName: string } }
) {
  const params = await Promise.resolve(context.params);
  const chainName = params.chainName;
  const limit = Math.min(
    20,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 5)
  );

  if (!chainName || typeof chainName !== "string") {
    return NextResponse.json([], { status: 400 });
  }

  if (API_BASE) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/chains/${encodeURIComponent(chainName)}/coins?limit=${limit}`,
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // fall through
    }
  }

  return NextResponse.json([]);
}
