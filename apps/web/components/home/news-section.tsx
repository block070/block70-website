import Link from "next/link";
import type { NewsArticleSummary } from "@/lib/api";

type NewsSectionProps = {
  items?: NewsArticleSummary[];
  errorMessage?: string | null;
};

export function NewsSection({ items = [], errorMessage = null }: NewsSectionProps) {
  const hasNews = items.length > 0;
  const whyTrending = (item: NewsArticleSummary) => {
    const explanation = item.rank_explanation ?? {};
    const sourceCount = Number(explanation.source_count ?? item.source_count ?? 1);
    const recency = Number(explanation.recency ?? 0);
    const relevance = Number(explanation.relevance ?? explanation.coin_relevance ?? 0);
    return `${sourceCount} sources · Recency ${Math.round(recency)} · Relevance ${Math.round(relevance)}`;
  };

  return (
    <section className="flex h-full min-h-[460px] flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--b70-text)]">Crypto News</h3>
          <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
            Macro and infra stories Block70 is watching right now.
          </p>
        </div>
        <Link
          href="/news"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-3 flex-1 space-y-2 overflow-auto">
        {errorMessage ? (
          <p className="text-xs text-[var(--b70-text-muted)]">
            Data temporarily unavailable.{" "}
            <span className="font-mono">{errorMessage}</span>
          </p>
        ) : hasNews ? (
          <ul className="space-y-2">
            {items.slice(0, 5).map((article) => (
              <li key={article.id}>
                <a
                  href={article.url}
                  target={article.url.startsWith("http") ? "_blank" : undefined}
                  rel={article.url.startsWith("http") ? "noreferrer" : undefined}
                  className="block rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-xs transition-colors hover:bg-slate-200/80 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
                >
                  <p className="font-medium text-[var(--b70-text)] line-clamp-2">
                    {article.title}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
                    <span className="mr-1 rounded border border-[var(--b70-border)] px-1 py-0.5 text-[9px] uppercase dark:border-slate-700">
                      {article.source}
                    </span>
                    {" · "}
                    {article.published_at
                      ? new Date(article.published_at).toLocaleDateString()
                      : "—"}
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-400/90">
                    Why Trending: {whyTrending(article)}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--b70-text-muted)]">
            No live news articles yet.
          </p>
        )}
      </div>
    </section>
  );
}
