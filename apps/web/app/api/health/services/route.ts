import { NextResponse } from "next/server";

import { backendGet, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

/** Minimal instructions shown in the UI when the API is unreachable (no secrets). */
const RUNBOOK = {
  title: "Start or restart the Block70 API",
  docker: "From the repo root: docker compose up -d api",
  dockerLogs: "docker compose logs -f api",
  uvicorn:
    "Local dev: cd apps/api then uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
  statusPage: "/status",
  docs: "See docs/REAL_DATA_LOCALLY.md in the repo for full setup.",
};

/**
 * Probes FastAPI `/health` using the same base URL + TLS fallback as narratives/airdrops.
 */
export async function GET() {
  const started = Date.now();
  const base = getBackendApiBase().replace(/\/$/, "");

  if (!base) {
    return NextResponse.json(
      {
        ok: false as const,
        reason: "no_api_base",
        message:
          "No backend URL is configured (set API_SERVER_URL or NEXT_PUBLIC_API_BASE_URL to your FastAPI origin).",
        runbook: RUNBOOK,
      },
      { status: 200 },
    );
  }

  const healthUrl = `${base}/health`;
  try {
    const r = await backendGet(healthUrl);
    const elapsed = Date.now() - started;
    if (!r.ok) {
      const body = (await r.text().catch(() => "")).slice(0, 200);
      return NextResponse.json(
        {
          ok: false as const,
          reason: "bad_status",
          status: r.status,
          message: `Backend returned HTTP ${r.status} for /health.`,
          detail: body || undefined,
          tried: healthUrl,
          latencyMs: elapsed,
          runbook: RUNBOOK,
        },
        { status: 200 },
      );
    }
    let payload: { status?: string } = {};
    try {
      payload = (await r.json()) as { status?: string };
    } catch {
      /* non-json health is still ok if 200 */
    }
    if (payload.status && payload.status !== "ok") {
      return NextResponse.json(
        {
          ok: false as const,
          reason: "unhealthy_payload",
          message: `Backend health body status is not ok: ${String(payload.status)}`,
          tried: healthUrl,
          latencyMs: elapsed,
          runbook: RUNBOOK,
        },
        { status: 200 },
      );
    }
    return NextResponse.json({
      ok: true as const,
      tried: healthUrl,
      latencyMs: elapsed,
    });
  } catch (err) {
    const elapsed = Date.now() - started;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false as const,
        reason: "network_error",
        message: msg,
        tried: healthUrl,
        latencyMs: elapsed,
        runbook: RUNBOOK,
      },
      { status: 200 },
    );
  }
}
