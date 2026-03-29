import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getApiBaseUrl } from "@/lib/api";
import { isPaidBlock70Plan } from "@/lib/plan-tier";

export const dynamic = "force-dynamic";

/**
 * Proxies to FastAPI `/api/v1/flows/summary` so the browser can poll with a same-origin URL.
 */
export async function GET(req: Request) {
  const base = getApiBaseUrl().replace(/\/$/, "");
  if (!base) {
    // #region agent log
    void fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9aa1f6" },
      body: JSON.stringify({
        sessionId: "9aa1f6",
        runId: "capitalflow",
        hypothesisId: "H_no_api_base",
        location: "api/flows/summary/route.ts:GET",
        message: "no API base configured",
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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

  const plan = cookies().get("block70_plan")?.value ?? "free";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (isPaidBlock70Plan(plan)) {
    headers["X-Block70-Plan"] = plan;
  }

  try {
    const r = await fetch(url, {
      cache: "no-store",
      headers,
    });
    const body = await r.text();
    // #region agent log
    let totalVol: number | null = null;
    let hotLen: number | null = null;
    try {
      const j = JSON.parse(body) as { total_volume?: number; hot_edges?: unknown[] };
      totalVol = typeof j.total_volume === "number" ? j.total_volume : null;
      hotLen = Array.isArray(j.hot_edges) ? j.hot_edges.length : null;
    } catch {
      /* ignore */
    }
    let apiHost = "unknown";
    try {
      apiHost = new URL(base).hostname;
    } catch {
      /* ignore */
    }
    void fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9aa1f6" },
      body: JSON.stringify({
        sessionId: "9aa1f6",
        runId: "capitalflow",
        hypothesisId: "H_proxy_upstream",
        location: "api/flows/summary/route.ts:GET",
        message: "proxy response",
        data: {
          apiHost,
          upstreamStatus: r.status,
          totalVol,
          hotLen,
          bodyChars: body.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return new NextResponse(body, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("Content-Type") || "application/json" },
    });
  } catch (e) {
    return NextResponse.json({ error: "upstream", message: String(e) }, { status: 502 });
  }
}
