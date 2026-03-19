import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

export async function GET(request: NextRequest) {
  const cookieToken = request.cookies.get("block70_session")?.value;
  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = headerToken || cookieToken;
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: data?.detail || "Failed to fetch current user" },
      { status: response.status || 401 },
    );
  }
  return NextResponse.json(data);
}

