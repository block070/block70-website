import { NextResponse } from "next/server";

import type { HourSnapshotPayload } from "@/lib/coin-signals-types";

export const revalidate = 3600;

function cothBaseUrl(): string {
  return process.env.CRYPTO_ON_THE_HOUR_URL?.replace(/\/$/, "") ?? "";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ timestamp: string }> | { timestamp: string } },
) {
  const { timestamp: raw } = await Promise.resolve(context.params);
  const hour = parseInt(raw, 10);
  if (!Number.isFinite(hour) || hour <= 0) {
    return NextResponse.json({ error: "invalid timestamp" }, { status: 400 });
  }

  const base = cothBaseUrl();
  if (!base) {
    return NextResponse.json({
      hourStartUnix: hour,
      hourEndUnix: hour + 3600,
      topics: [],
    } satisfies HourSnapshotPayload);
  }

  try {
    const res = await fetch(`${base}/content/hour/${hour}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: 502 });
    }
    const data = (await res.json()) as HourSnapshotPayload;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
