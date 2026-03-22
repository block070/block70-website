import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (API_BASE) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/exchanges/${encodeURIComponent(id)}/click`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // non-blocking
    }
  }

  return NextResponse.json({ status: "ok", exchange_id: id });
}
