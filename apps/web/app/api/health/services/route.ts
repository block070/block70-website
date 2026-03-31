import { NextResponse } from "next/server";

import {
  backendGet,
  getBackendApiBase,
  type BackendGetResult,
} from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

/**
 * Set on Vercel/host when the marketing site is deployed without a reachable FastAPI
 * (homepage uses CoinGecko fallback). Hides the yellow banner; does not fix the API.
 */
const SKIP_BACKEND_HEALTH =
  process.env.HIDE_BACKEND_HEALTH_BANNER === "1" ||
  process.env.SKIP_BACKEND_HEALTH_CHECK === "1";

function formatNetworkErrorMessage(err: unknown, tried: string[]): string {
  const raw = err instanceof Error ? err.message : String(err);
  const joined = tried.join(" · ");
  const lower = raw.toLowerCase();
  if (
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("network") ||
    lower.includes("undici")
  ) {
    return `Could not reach the Block70 API (${joined}). The server may be down, the URL may be wrong, or a firewall may block server-side requests. The homepage can still show public market data without the API.`;
  }
  return raw.length > 320 ? `${raw.slice(0, 317)}…` : raw;
}

async function probeHealthPaths(
  base: string,
): Promise<{ r: BackendGetResult; healthUrl: string }> {
  const urls = [`${base}/health`, `${base}/api/v1/health`];
  let lastErr: unknown;
  for (const healthUrl of urls) {
    try {
      const r = await backendGet(healthUrl);
      if (r.ok) return { r, healthUrl };
      lastErr = new Error(`HTTP ${r.status} for ${healthUrl}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Minimal instructions shown in the UI when the API is unreachable (no secrets). */
const RUNBOOK = {
  title: "Start or restart the Block70 API",
  note: "This yellow banner only checks connectivity—it does not restart Docker or your VPS. Restart commands must be run on the server that hosts the API.",
  docker:
    "From the repo root (first deploy / after pull): docker compose up -d api",
  dockerRestart:
    "Quick restart API container only: docker compose restart api  ·  or: docker restart block70-api",
  dockerLogs: "docker compose logs -f api --tail 100",
  uvicorn:
    "Local dev: cd apps/api then uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
  statusPage: "/servicestatus",
  docs: "See docs/DEPLOY.md (recovery) and docs/REAL_DATA_LOCALLY.md. Optional cron: scripts/restart-api-if-unhealthy.sh",
};

/**
 * Probes FastAPI `/health` using the same base URL + TLS fallback as narratives/airdrops.
 */
export async function GET() {
  const started = Date.now();

  if (SKIP_BACKEND_HEALTH) {
    return NextResponse.json({
      ok: true as const,
      skipped: true as const,
      message: "Backend health probe disabled (HIDE_BACKEND_HEALTH_BANNER or SKIP_BACKEND_HEALTH_CHECK).",
      latencyMs: Date.now() - started,
    });
  }

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

  const triedUrls = [`${base}/health`, `${base}/api/v1/health`];
  try {
    const { r, healthUrl } = await probeHealthPaths(base);
    const elapsed = Date.now() - started;
    if (!r.ok) {
      const body = (await r.text().catch(() => "")).slice(0, 200);
      return NextResponse.json(
        {
          ok: false as const,
          reason: "bad_status",
          status: r.status,
          message: `Backend returned HTTP ${r.status} for health.`,
          detail: body || undefined,
          tried: triedUrls.join(" · "),
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
          tried: triedUrls.join(" · "),
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
    return NextResponse.json(
      {
        ok: false as const,
        reason: "network_error",
        message: formatNetworkErrorMessage(err, triedUrls),
        tried: triedUrls.join(" · "),
        latencyMs: elapsed,
        runbook: RUNBOOK,
      },
      { status: 200 },
    );
  }
}
