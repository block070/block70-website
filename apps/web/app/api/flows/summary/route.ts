import { NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Proxies to FastAPI `/api/v1/flows/summary` so the browser can poll with a same-origin URL.
 */
export async function GET(req: Request) {
  const base = getApiBaseUrl().replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      {
        error: "no_api_base",
        message: "Set API_SERVER_URL or NEXT_PUBLIC_API_BASE_URL for the FastAPI origin.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = `${base}/api/v1/flows/summary${qs ? `?${qs}` : ""}`;

  try {
    const r = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("Content-Type") || "application/json" },
    });
  } catch (e) {
    return NextResponse.json({ error: "upstream", message: String(e) }, { status: 502 });
  }
}
