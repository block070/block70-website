import Link from "next/link";
import type { SeedNewsItem } from "@/lib/news-seed";
import { isDemoMode } from "@/lib/demo";

type NewsSectionProps = {
  items?: SeedNewsItem[];
};

export function NewsSection({ items = [] }: NewsSectionProps) {
  const hasNews = items.length > 0;
  const demo = isDemoMode();

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">Crypto news</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Macro and infra stories Block70 is watching right now.
          </p>
          {demo && (
            <p className="mt-1 text-[10px] text-amber-300">
              Demo headlines for illustration; not a live feed.
            </p>
          )}
        </div>
        <Link
          href="/news"
          className="text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      {hasNews ? (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((article) => (
            <li key={article.id}>
              <a
                href={article.url}
                target={article.url.startsWith("http") ? "_blank" : undefined}
                rel={article.url.startsWith("http") ? "noreferrer" : undefined}
                className="block rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs transition-colors hover:border-slate-700 hover:bg-slate-800/50"
              >
                <p className="font-medium text-slate-100 line-clamp-2">
                  {article.title}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {article.source} · {article.category} ·{" "}
                  {new Date(article.published_at).toLocaleDateString()}
                </p>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          No news articles yet. This section will populate once the news engine
          is connected to live feeds.
        </p>
      )}
    </section>
  );
}
