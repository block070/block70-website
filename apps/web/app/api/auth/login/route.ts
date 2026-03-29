import { NextRequest, NextResponse } from "next/server";

function getApiBaseUrl() {
  return process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ detail: "Email and password are required" }, { status: 400 });
  }

  // #region agent log
  fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9aa1f6" },
    body: JSON.stringify({
      sessionId: "9aa1f6",
      location: "apps/web/app/api/auth/login/route.ts:POST",
      message: "login_proxy_json_body",
      data: { hypothesisId: "H2", emailLen: body.email.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { detail: data?.detail || "Invalid email or password" },
      { status: response.status || 401 },
    );
  }

  const token = data?.access_token as string | undefined;
  const plan = (data?.user?.plan as string | undefined) || "free";
  const res = NextResponse.json(data);
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

