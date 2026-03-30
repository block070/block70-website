import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    name?: string;
    accept_terms?: boolean;
    accept_privacy?: boolean;
    accept_disclaimer?: boolean;
    ref_code?: string | null;
    ref_source?: string | null;
  };

  if (!body.email?.trim()) {
    return NextResponse.json({ detail: "Email is required" }, { status: 400 });
  }

  const payload = {
    email: body.email.trim(),
    name: body.name,
    accept_terms: body.accept_terms ?? true,
    accept_privacy: body.accept_privacy ?? true,
    accept_disclaimer: body.accept_disclaimer ?? true,
    ref_code: body.ref_code ?? null,
    ref_source: body.ref_source ?? null,
  };

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/auth/register-lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: typeof data?.detail === "string" ? data.detail : "Lead registration failed" },
      { status: response.status || 400 },
    );
  }

  const token = data?.access_token as string | undefined | null;
  const plan =
    (data?.user?.plan_type as string | undefined) ||
    (data?.user?.plan as string | undefined) ||
    "free";
  const res = NextResponse.json(data, { status: 200 });
  if (token) {
    res.cookies.set("block70_session", token, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set("block70_plan", plan, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
