import { NextRequest, NextResponse } from "next/server";
import type { ExchangeVolumeChartPayload } from "@/lib/exchange-liquidity-types";

const CG = "https://api.coingecko.com/api/v3";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const daysRaw = request.nextUrl.searchParams.get("days") ?? "30";
  const days = /^\d+$/.test(daysRaw) ? daysRaw : "30";

  let res: Response;
  try {
    res = await fetch(
      `${CG}/exchanges/${encodeURIComponent(id)}/volume_chart?days=${days}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      },
    );
  } catch {
    return NextResponse.json({ error: "Upstream failed" }, { status: 502 });
  }

  if (res.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "CoinGecko error" }, { status: 502 });
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 502 });
  }

  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "Unexpected shape" }, { status: 502 });
  }

  const series: [number, number][] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const ts = Number(row[0]);
    const vol = typeof row[1] === "number" ? row[1] : Number(row[1]);
    if (Number.isFinite(ts) && Number.isFinite(vol)) {
      series.push([ts, vol]);
    }
  }

  const body: ExchangeVolumeChartPayload = { series };
  return NextResponse.json(body);
}
