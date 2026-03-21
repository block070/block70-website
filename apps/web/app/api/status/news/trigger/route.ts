import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function POST() {
  if (!API_BASE) {
    return NextResponse.json(
      { status: "error", message: "API backend not configured" },
      { status: 503 }
    );
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/status/news/trigger`, {
      method: "POST",
      cache: "no-store",
    });
    const data = (await res.json()) as { status: string; message: string };
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to trigger news scraper",
      },
      { status: 502 }
    );
  }
}
