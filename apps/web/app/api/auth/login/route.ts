import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ detail: "Email and password are required" }, { status: 400 });
  }

  const apiBase = getApiBaseUrl();
  const response = await fetch(
    `${apiBase}/api/v1/auth/login?email=${encodeURIComponent(body.email)}&password=${encodeURIComponent(body.password)}`,
    { method: "POST" },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: data?.detail || "Invalid email or password" },
      { status: response.status || 401 },
    );
  }

  const token = data?.access_token as string | undefined;
  const res = NextResponse.json(data);
  if (token) {
    res.cookies.set("block70_session", token, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

