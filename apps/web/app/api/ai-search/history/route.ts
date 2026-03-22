import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json([], { status: 200 });
  }
  const authHeader = request.headers.get("authorization");
  const cookieToken = request.cookies.get("block70_session")?.value;
  const token = authHeader?.replace(/^Bearer\s+/i, "") || cookieToken;
  if (!token) {
    return NextResponse.json([], { status: 200 });
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai-search/history`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
