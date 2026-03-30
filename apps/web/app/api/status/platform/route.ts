import { NextResponse } from "next/server";

import { backendGet, getBackendApiBase } from "@/lib/narratives/resolve-narratives-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = getBackendApiBase().replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      {
        checked_at: new Date().toISOString(),
        overall: "outage" as const,
        components: {
          api: {
            name: "API & database",
            status: "outage" as const,
            detail: "Backend URL not configured (API_SERVER_URL / NEXT_PUBLIC_API_BASE_URL).",
            latency_ms: null,
          },
          signals: {
            name: "Signals pipeline",
            status: "outage" as const,
            detail: "Cannot reach API.",
          },
          ai: {
            name: "AI services",
            status: "outage" as const,
            detail: "Cannot reach API.",
          },
        },
      },
      { status: 503 },
    );
  }

  const url = `${base}/api/v1/status/platform`;
  try {
    const res = await backendGet(url);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch platform status";
    return NextResponse.json(
      {
        checked_at: new Date().toISOString(),
        overall: "outage" as const,
        components: {
          api: {
            name: "API & database",
            status: "outage" as const,
            detail: `${msg} (Tried: ${url})`,
            latency_ms: null,
          },
          signals: {
            name: "Signals pipeline",
            status: "outage" as const,
            detail: "Unreachable.",
          },
          ai: {
            name: "AI services",
            status: "outage" as const,
            detail: "Unreachable.",
          },
        },
      },
      { status: 502 },
    );
  }
}
