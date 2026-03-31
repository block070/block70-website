import { NextResponse } from "next/server";
import { buildHomeDashboard } from "@/lib/home/build-home-dashboard";

/**
 * No data cache: market snapshot + heatmap must reflect each request’s upstream
 * (FastAPI / CoinGecko). stale `unstable_cache` + CDN s-maxage previously kept demo tiles.
 */
export async function GET() {
  try {
    const data = await buildHomeDashboard();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Dashboard build failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
