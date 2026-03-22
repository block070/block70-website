import { getLatestNews } from "@/lib/api";
import { NewsFeed } from "@/components/news/news-feed";
import { withTimeout } from "@/lib/with-timeout";

export const metadata = {
  title: "News · Block70",
  description:
    "Curated macro and infrastructure stories that matter for Block70 operators.",
};

export const revalidate = 60;

export default async function NewsPage() {
  let articles: Awaited<ReturnType<typeof getLatestNews>> = [];
  let errorMessage: string | null = null;
  try {
    articles = await withTimeout(
      getLatestNews({ limit: 50 }),
      8_000
    );
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  const hasArticles = articles.length > 0;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">News</h1>
        <p className="text-sm text-slate-400">
          A curated macro surface for ecosystem moves, restaking, perps, and
          infra shifts that Block70 tracks most closely.
        </p>
      </header>
      {errorMessage ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
          <p className="font-medium text-slate-100">Data temporarily unavailable</p>
          <p className="mt-1 text-xs text-slate-500">
            {errorMessage}
          </p>
        </div>
      ) : !hasArticles ? (
        <p className="mt-4 text-sm text-slate-500">No live news articles yet.</p>
      ) : (
        <NewsFeed articles={articles} />
      )}
    </div>
  );
}

