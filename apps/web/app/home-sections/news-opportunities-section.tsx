import { getNewsArticles, getOpportunities } from "@/lib/api";
import { NewsSection } from "@/components/home/news-section";
import { TopOpportunities } from "@/components/home/top-opportunities";
import { withTimeout } from "@/lib/with-timeout";

const FETCH_TIMEOUT_MS = 6_000;

export async function NewsOpportunitiesSection() {
  const [newsResult, oppsResult] = await Promise.allSettled([
    withTimeout(getNewsArticles({ limit: 8 }), FETCH_TIMEOUT_MS),
    withTimeout(getOpportunities(), FETCH_TIMEOUT_MS),
  ]);

  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const newsError = newsResult.status === "rejected"
    ? (newsResult.reason instanceof Error ? newsResult.reason.message : "Unknown error")
    : null;

  const opportunities = oppsResult.status === "fulfilled"
    ? oppsResult.value.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    : [];
  const oppsError = oppsResult.status === "rejected"
    ? (oppsResult.reason instanceof Error ? oppsResult.reason.message : "Unknown error")
    : null;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <NewsSection items={news} errorMessage={newsError} />
      <TopOpportunities opportunities={opportunities} errorMessage={oppsError} />
    </section>
  );
}
