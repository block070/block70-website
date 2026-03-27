import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  buildHomeDashboard,
  HOME_DASHBOARD_CACHE_SEC,
} from "@/lib/home/build-home-dashboard";

const getCachedDashboard = unstable_cache(
  async () => buildHomeDashboard(),
  ["home-intelligence-dashboard-v1"],
  { revalidate: HOME_DASHBOARD_CACHE_SEC },
);

export async function GET() {
  try {
    const data = await getCachedDashboard();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${HOME_DASHBOARD_CACHE_SEC}, stale-while-revalidate=${HOME_DASHBOARD_CACHE_SEC * 4}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Dashboard build failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
