import { getLatestNews } from "@/lib/api";
import { NewsIntelligence } from "@/components/news/news-intelligence";
import { buildNewsIntelligence } from "@/lib/news/build-news-intelligence";
import { withTimeout } from "@/lib/with-timeout";

export const metadata = {
  title: "News · Block70",
  description:
    "Narrative intelligence — summaries, sentiment, impact, and thematic clusters on the stories that move crypto markets.",
};

export const revalidate = 60;

export default async function NewsPage() {
  let articles: Awaited<ReturnType<typeof getLatestNews>> = [];
  let errorMessage: string | null = null;
  try {
    articles = await withTimeout(getLatestNews({ limit: 50 }), 8_000);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  const payload = buildNewsIntelligence(articles);

  return (
    <div className="space-y-6">
      <NewsIntelligence payload={payload} fetchError={errorMessage} />
    </div>
  );
}

