import { NextResponse } from "next/server";
import { HOME_DASHBOARD_CACHE_SEC } from "@/lib/home/build-home-dashboard";
import { getHomeDashboardPayload } from "@/lib/home/get-cached-home-dashboard";

export async function GET() {
  try {
    const data = await getHomeDashboardPayload();
    // #region agent log
    fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "3a0a47",
      },
      body: JSON.stringify({
        sessionId: "3a0a47",
        timestamp: Date.now(),
        runId: process.env.DEBUG_RUN_ID ?? "api-home-dashboard",
        hypothesisId: "D",
        location: "api/home/dashboard/route.ts:GET",
        message: "JSON payload hero fields",
        data: {
          heroMcap: data.hero.totalMarketCapUsd,
          heroVol: data.hero.volume24hUsd,
          heroBtc: data.hero.btcDominancePct,
          heroEth: data.hero.ethDominancePct,
          generatedAt: data.meta.generatedAt,
          marketSource: data.meta.marketSource ?? null,
        },
      }),
    }).catch(() => {});
    // #endregion
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
