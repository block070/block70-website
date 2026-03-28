import type { AlphaEvent, AlphaRankedOpportunity } from "@/lib/types";
import { getAlphaFeed, getAlphaTop, getLatestBriefing } from "@/lib/api";
import { getTrendingAlpha, type AlphaPostDto } from "@/lib/community-api";
import { AlphaDeskClient } from "@/components/alpha/alpha-desk-client";
import { withTimeout } from "@/lib/with-timeout";

const FETCH_MS = 8_000;

export default async function AlphaPage() {
  const loadWarnings: string[] = [];

  const postsP = withTimeout(
    getTrendingAlpha(48).catch(() => {
      loadWarnings.push("Trending community posts could not be loaded.");
      return [] as AlphaPostDto[];
    }),
    FETCH_MS,
    [],
  );

  const topP = withTimeout(
    getAlphaTop().catch(() => {
      loadWarnings.push("Alpha top rankings could not be loaded.");
      return [] as AlphaRankedOpportunity[];
    }),
    FETCH_MS,
    [],
  );

  const feedP = withTimeout(
    getAlphaFeed(24).catch(() => {
      loadWarnings.push("Alpha event stream could not be loaded.");
      return [] as AlphaEvent[];
    }),
    FETCH_MS,
    [],
  );

  const briefingP = withTimeout(
    getLatestBriefing().catch(() => null),
    FETCH_MS,
    null,
  );

  const [initialPosts, initialAlphaTop, initialAlphaFeed, briefingRaw] =
    await Promise.all([postsP, topP, feedP, briefingP]);

  const briefing =
    briefingRaw != null
      ? {
          id: briefingRaw.id,
          summary: briefingRaw.summary,
          created_at: briefingRaw.created_at,
        }
      : null;

  if (
    loadWarnings.length === 0 &&
    initialPosts.length === 0 &&
    initialAlphaTop.length === 0 &&
    initialAlphaFeed.length === 0
  ) {
    loadWarnings.push(
      "No desk data in view—check API connectivity or try again later.",
    );
  }

  return (
    <AlphaDeskClient
      initialPosts={initialPosts}
      initialAlphaTop={initialAlphaTop}
      initialAlphaFeed={initialAlphaFeed}
      briefing={briefing}
      loadWarnings={loadWarnings}
    />
  );
}
