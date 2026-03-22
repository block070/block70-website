import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET() {
  if (!API_BASE) {
    return NextResponse.json(
      { scheduler_running: false, jobs: [], error: "API backend not configured" },
      { status: 503 }
    );
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/status`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch status";
    const isNetwork =
      /fetch failed|Failed to fetch|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg);
    const error = isNetwork
      ? "Backend API unreachable. The Block70 API server may be down, or API_SERVER_URL may be incorrect. Use a process monitor (Docker restart policy, systemd) for auto-restart."
      : msg;
    return NextResponse.json(
      {
        scheduler_running: false,
        jobs: [],
        error,
      },
      { status: 502 }
    );
  }
}
