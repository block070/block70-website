import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };
  if (!body.email?.trim()) {
    return NextResponse.json({ detail: "Email is required" }, { status: 400 });
  }

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email.trim() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: data?.detail || "Could not start password reset" },
      { status: response.status || 400 },
    );
  }
  return NextResponse.json(data);
}
