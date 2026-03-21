import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const params = await Promise.resolve(context.params);
  const slug = params.slug;
  const daysParam = request.nextUrl.searchParams.get("days") || "7";
  const daysNum = Number(daysParam);
  const daysQuery =
    daysParam === "max" || daysNum > 365 ? "max" : String(daysParam);
  if (!API_BASE) {
    return NextResponse.json(
      { prices: [], error: "API backend not configured" },
      { status: 503 }
    );
  }
  if (!slug || typeof slug !== "string") {
    return NextResponse.json(
      { prices: [], error: "Invalid slug" },
      { status: 400 }
    );
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/coins/${encodeURIComponent(slug)}/chart?days=${daysQuery}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as { prices?: unknown[]; detail?: string };
    if (!res.ok) {
      return NextResponse.json(
        { prices: [], error: data.detail || data || "Chart unavailable" },
        { status: res.status >= 500 ? 502 : res.status }
      );
    }
    return NextResponse.json({ prices: data.prices ?? [] });
  } catch (err) {
    return NextResponse.json(
      {
        prices: [],
        error: err instanceof Error ? err.message : "Failed to fetch chart data",
      },
      { status: 502 }
    );
  }
}
