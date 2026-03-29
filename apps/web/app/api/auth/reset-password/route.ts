import { NextRequest, NextResponse } from "next/server";

import { backendPostJson, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = (await request.json()) as { token?: string; password?: string };
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }
  if (!body.token?.trim() || !body.password) {
    return NextResponse.json(
      { detail: "Reset token and new password are required" },
      { status: 400 },
    );
  }

  const base = getBackendApiBase().replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { detail: "Backend URL is not configured on this deployment." },
      { status: 503 },
    );
  }

  try {
    const r = await backendPostJson(`${base}/api/v1/auth/reset-password`, {
      token: body.token.trim(),
      password: body.password,
    });
    const text = await r.text();
    let data: { detail?: string } = {};
    try {
      data = JSON.parse(text) as { detail?: string };
    } catch {
      /* ignore */
    }
    if (!r.ok) {
      return NextResponse.json(
        { detail: data.detail || "Password reset failed" },
        { status: r.status >= 400 && r.status < 600 ? r.status : 502 },
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { detail: `Could not reach authentication service (${msg.slice(0, 200)})` },
      { status: 502 },
    );
  }
}
