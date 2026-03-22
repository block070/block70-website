import { getSignalsTrending } from "@/lib/api";
import { TrendingCoins } from "@/components/home/trending-coins";
import { withTimeout } from "@/lib/with-timeout";

const FETCH_TIMEOUT_MS = 6_000;

export async function TrendingSection() {
  let trending: Awaited<ReturnType<typeof getSignalsTrending>> = [];
  let errorMessage: string | null = null;

  try {
    trending = await withTimeout(
      getSignalsTrending({ hours: 24, limit: 12 }),
      FETCH_TIMEOUT_MS
    );
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Unknown error";
  }

  return <TrendingCoins trending={trending} errorMessage={errorMessage} />;
}
