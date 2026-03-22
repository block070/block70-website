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
    const res = await fetch(`${API_BASE}/bootstrap/all-coins`, {
      method: "POST",
      cache: "no-store",
    });
    const data = (await res.json()) as {
      status: string;
      message: string;
      synced_pages?: number;
      description_stats?: Record<string, number>;
    };
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        message:
          err instanceof Error ? err.message : "Failed to trigger coin update",
      },
      { status: 502 }
    );
  }
}
