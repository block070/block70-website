import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> | { symbol: string } }
) {
  const params = await Promise.resolve(context.params);
  const symbol = params.symbol;
  const timeframe = request.nextUrl.searchParams.get("timeframe") || "1h";
  const limit = request.nextUrl.searchParams.get("limit") || "200";

  if (!API_BASE) {
    return NextResponse.json(
      { ohlcv: [], error: "API backend not configured" },
      { status: 503 }
    );
  }
  if (!symbol || typeof symbol !== "string") {
    return NextResponse.json(
      { ohlcv: [], error: "Invalid symbol" },
      { status: 400 }
    );
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/charts/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=${limit}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as { ohlcv?: unknown[]; detail?: string };
    if (!res.ok) {
      return NextResponse.json(
        { ohlcv: [], error: data.detail || data || "Chart unavailable" },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    return NextResponse.json({ ohlcv: data.ohlcv ?? [] });
  } catch (err) {
    return NextResponse.json(
      {
        ohlcv: [],
        error: err instanceof Error ? err.message : "Failed to fetch chart data",
      },
      { status: 502 }
    );
  }
}
