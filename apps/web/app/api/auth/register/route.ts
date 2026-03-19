import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

function fallbackName(email: string): string {
  const left = email.split("@")[0] || "block70-user";
  return left.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "block70-user";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
    ref_code?: string | null;
    ref_source?: string | null;
    accept_terms?: boolean;
    accept_privacy?: boolean;
    accept_disclaimer?: boolean;
  };

  if (!body.email || !body.password) {
    return NextResponse.json({ detail: "Email and password are required" }, { status: 400 });
  }

  const payload = {
    email: body.email,
    password: body.password,
    name: body.name || fallbackName(body.email),
    accept_terms: body.accept_terms ?? true,
    accept_privacy: body.accept_privacy ?? true,
    accept_disclaimer: body.accept_disclaimer ?? true,
    ref_code: body.ref_code ?? null,
    ref_source: body.ref_source ?? null,
  };

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: data?.detail || "Registration failed" },
      { status: response.status || 400 },
    );
  }
  return NextResponse.json(data, { status: 201 });
}

