import { NextResponse } from "next/server";
import { HOME_DASHBOARD_CACHE_SEC } from "@/lib/home/build-home-dashboard";
import { getHomeDashboardPayload } from "@/lib/home/get-cached-home-dashboard";

export async function GET() {
  try {
    const data = await getHomeDashboardPayload();
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    const cacheControl = demo
      ? "private, no-store, max-age=0, must-revalidate"
      : `public, s-maxage=${HOME_DASHBOARD_CACHE_SEC}, stale-while-revalidate=${HOME_DASHBOARD_CACHE_SEC * 2}`;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": cacheControl,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Dashboard build failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
