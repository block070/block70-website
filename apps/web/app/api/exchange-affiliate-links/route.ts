import { NextResponse } from "next/server";

const API_BASE =
  (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export async function GET() {
  if (!API_BASE) {
    return NextResponse.json({ templates: {} });
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/exchange-affiliate-links`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ templates: {} }, { status: 200 });
    }
    const body = (await res.json()) as { templates?: Record<string, string> };
    return NextResponse.json(
      { templates: body.templates ?? {} },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch {
    return NextResponse.json({ templates: {} });
  }
}
