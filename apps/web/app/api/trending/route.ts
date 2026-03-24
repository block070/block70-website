import { NextResponse } from "next/server";

import { getTrendingPagePayload } from "@/lib/trending-page-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTrendingPagePayload();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to load trending data" },
      { status: 502 }
    );
  }
}
