import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

/**
 * Same-origin proxy for sentiment AI summary (avoids mixed content when the public
 * env points at http:// while the site is served over https).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  const { token } = await Promise.resolve(context.params);
  const sym = decodeURIComponent(token || "").trim();
  if (!sym) {
    return NextResponse.json({ detail: "Missing token" }, { status: 400 });
  }
  if (!API_BASE) {
    return NextResponse.json({ detail: "API backend not configured" }, { status: 503 });
  }
  const url = `${API_BASE}/api/v1/sentiment/${encodeURIComponent(sym)}/ai-summary`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream error";
    return NextResponse.json({ detail: msg }, { status: 502 });
  }
}
