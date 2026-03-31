import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { detail: "API backend not configured" },
      { status: 503 },
    );
  }
  try {
    const authHeader = request.headers.get("authorization");
    const cookieToken = request.cookies.get("block70_session")?.value;
    const token = authHeader?.replace(/^Bearer\s+/i, "") || cookieToken;

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const qs = request.nextUrl.searchParams.toString();
    const res = await fetch(
      `${API_BASE}/api/v1/ai-intelligence/opportunities${qs ? `?${qs}` : ""}`,
      { headers, cache: "no-store" },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Request failed" },
      { status: 502 },
    );
  }
}
