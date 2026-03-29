import { NextResponse } from "next/server";

import { backendGet, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = getBackendApiBase().replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { scheduler_running: false, jobs: [], error: "API backend not configured" },
      { status: 503 },
    );
  }

  const url = `${base}/api/v1/status`;
  try {
    const res = await backendGet(url);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { error: "Invalid JSON from status endpoint" };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch status";
    const isNetwork =
      /fetch failed|Failed to fetch|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg);
    const baseMsg =
      "Backend API unreachable. The Block70 API server may be down, or API_SERVER_URL may be incorrect. Docker: docker compose up -d api · Local: cd apps/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000";
    const error = isNetwork ? baseMsg : msg;
    return NextResponse.json(
      {
        scheduler_running: false,
        jobs: [],
        error: `${error} (Tried: ${url})`,
      },
      { status: 502 },
    );
  }
}
