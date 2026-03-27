import { NextRequest, NextResponse } from "next/server";

import { getTrendingPagePayload } from "@/lib/trending-page-data";

export const dynamic = "force-dynamic";

function parseHours(raw: string | null): number | undefined {
  if (raw === "1" || raw === "6" || raw === "24") return Number(raw);
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const hours = parseHours(req.nextUrl.searchParams.get("hours"));
    const data = await getTrendingPagePayload(hours);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to load trending data" },
      { status: 502 },
    );
  }
}
