import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json([], { status: 200 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "20";
    const res = await fetch(
      `${API_BASE}/api/v1/ai-search/popular?limit=${limit}`,
      { cache: "no-store" }
    );
    const data = await res.json().catch(() => []);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
