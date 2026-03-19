import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("block70_session")?.value;
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/auth/upgrade-me`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: data?.detail || "Upgrade failed" },
      { status: response.status || 400 },
    );
  }

  const res = NextResponse.json({ ok: true, user: data });
  res.cookies.set("block70_plan", "pro", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

