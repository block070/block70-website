import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug;
  const days = request.nextUrl.searchParams.get("days") || "7";
  if (!API_BASE) {
    return NextResponse.json(
      { error: "API backend not configured" },
      { status: 503 }
    );
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/coins/${encodeURIComponent(slug)}/chart?days=${encodeURIComponent(days)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch chart data",
      },
      { status: 502 }
    );
  }
}
