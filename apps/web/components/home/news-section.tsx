import Link from "next/link";

export type NewsItem = {
  title: string;
  source: string;
  url: string;
  published_at?: string | null;
};

type NewsSectionProps = {
  items?: NewsItem[];
};

const FALLBACK_NEWS: NewsItem[] = [
  {
    title: "Bitcoin holds above $67k as institutional flows strengthen",
    source: "Block70",
    url: "/news",
    published_at: new Date().toISOString(),
  },
  {
    title: "Ethereum L2 activity hits new highs",
    source: "Block70",
    url: "/news",
    published_at: new Date().toISOString(),
  },
  {
    title: "Solana ecosystem tokens lead weekly gains",
    source: "Block70",
    url: "/news",
    published_at: new Date().toISOString(),
  },
];

export function NewsSection({ items = FALLBACK_NEWS }: NewsSectionProps) {
  const list = items.length > 0 ? items : FALLBACK_NEWS;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">Crypto news</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Latest from news scraper
          </p>
        </div>
        <Link
          href="/news"
          className="text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {list.slice(0, 5).map((article, i) => (
          <li key={`${article.url}-${i}`}>
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
                {article.source}
                {article.published_at
                  ? ` · ${new Date(article.published_at).toLocaleDateString()}`
                  : ""}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
