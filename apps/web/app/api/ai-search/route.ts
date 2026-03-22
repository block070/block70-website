import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function POST(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { detail: "API backend not configured" },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const authHeader = request.headers.get("authorization");
    const cookieToken = request.cookies.get("block70_session")?.value;
    const token = authHeader?.replace(/^Bearer\s+/i, "") || cookieToken;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/v1/ai-search`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "AI search failed" },
      { status: 502 }
    );
  }
}
