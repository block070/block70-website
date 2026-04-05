import "server-only";
import { unstable_cache } from "next/cache";
import { buildHomeDashboard, HOME_DASHBOARD_CACHE_SEC } from "@/lib/home/build-home-dashboard";

function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/**
 * Dashboard payload for the homepage and GET /api/home/dashboard.
 * Non-demo: memoized with Next data cache (matches HOME_DASHBOARD_CACHE_SEC).
 * Demo: always fresh so tiles never stay on stale demo data.
 */
export async function getHomeDashboardPayload() {
  if (isDemoMode()) {
    return buildHomeDashboard();
  }
  const ttl = Math.max(1, HOME_DASHBOARD_CACHE_SEC);
  const run = unstable_cache(
    async () => buildHomeDashboard(),
    ["home-dashboard-payload-v5"],
    { revalidate: ttl },
  );
  return run();
}
