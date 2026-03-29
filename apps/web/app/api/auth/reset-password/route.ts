import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { token?: string; password?: string };
  if (!body.token?.trim() || !body.password) {
    return NextResponse.json(
      { detail: "Reset token and new password are required" },
      { status: 400 },
    );
  }

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: body.token.trim(), password: body.password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: data?.detail || "Password reset failed" },
      { status: response.status || 400 },
    );
  }
  return NextResponse.json(data);
}
