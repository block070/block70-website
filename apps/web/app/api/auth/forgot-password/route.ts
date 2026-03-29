import { NextRequest, NextResponse } from "next/server";

import { backendPostJson, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }
  if (!body.email?.trim()) {
    return NextResponse.json({ detail: "Email is required" }, { status: 400 });
  }

  const base = getBackendApiBase().replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      {
        detail:
          "Password reset is not available: backend URL is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  try {
    const r = await backendPostJson(`${base}/api/v1/auth/forgot-password`, {
      email: body.email.trim(),
    });
    const text = await r.text();
    let data: { detail?: string } = {};
    try {
      data = JSON.parse(text) as { detail?: string };
    } catch {
      /* non-JSON error page */
    }
    if (!r.ok) {
      return NextResponse.json(
        { detail: data.detail || "Could not start password reset" },
        { status: r.status >= 400 && r.status < 600 ? r.status : 502 },
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        detail: `Could not reach authentication service (${msg.slice(0, 200)})`,
      },
      { status: 502 },
    );
  }
}
