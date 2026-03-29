import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { emptyCapitalFlowSummary } from "@/lib/capital-flow-summary-empty";
import { isPaidBlock70Plan } from "@/lib/plan-tier";
import { backendGet, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

/**
 * Proxies to FastAPI `/api/v1/flows/summary` using the same backend base + TLS retry
 * as `/api/health/services` (`getBackendApiBase` + `backendGet`), not `getApiBaseUrl`
 * (which can fall back to the Vercel / marketing host and break with `fetch failed`).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const hours = Math.min(720, Math.max(1, Number(searchParams.get("hours")) || 24));
  const chainRaw = searchParams.get("chain");
  const chain = chainRaw && chainRaw.trim() ? chainRaw.trim() : null;

  const base = getBackendApiBase().replace(/\/$/, "");
  if (!base) {
    // #region agent log
    void fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9aa1f6" },
      body: JSON.stringify({
        sessionId: "9aa1f6",
        runId: "capitalflow",
        hypothesisId: "H_no_backend_base",
        location: "api/flows/summary/route.ts:GET",
        message: "no getBackendApiBase",
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json(
      emptyCapitalFlowSummary(
        hours,
        chain,
        "No backend URL configured. Set API_SERVER_URL or NEXT_PUBLIC_API_BASE_URL to your FastAPI origin.",
      ),
      { status: 200, headers: { "X-Block70-Flows-Source": "no-api-base" } },
    );
  }

  const url = `${base}/api/v1/flows/summary${qs ? `?${qs}` : ""}`;
  const plan = cookies().get("block70_plan")?.value ?? "free";
  const headers: Record<string, string> = {};
  if (isPaidBlock70Plan(plan)) {
    headers["X-Block70-Plan"] = plan;
  }

  let apiHost = "unknown";
  try {
    apiHost = new URL(base).hostname;
  } catch {
    /* ignore */
  }

  try {
    const r = await backendGet(url, headers);
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
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // #region agent log
    void fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9aa1f6" },
      body: JSON.stringify({
        sessionId: "9aa1f6",
        runId: "capitalflow",
        hypothesisId: "H_upstream_network",
        location: "api/flows/summary/route.ts:GET",
        message: "upstream fetch threw",
        data: { apiHost, err: msg.slice(0, 160) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json(
      emptyCapitalFlowSummary(
        hours,
        chain,
        `Capital-flow API unreachable (${msg.slice(0, 120)}). Showing an empty ledger; free accounts see sample data when there is no live feed.`,
      ),
      { status: 200, headers: { "X-Block70-Flows-Source": "upstream-unavailable" } },
    );
  }
}
