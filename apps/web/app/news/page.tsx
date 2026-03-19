import { getLatestNews } from "@/lib/api";

export const metadata = {
  title: "News · Block70",
  description:
    "Curated macro and infrastructure stories that matter for Block70 operators.",
};

function stripHtml(input: string): string {
  // Remove tags and collapse whitespace; keeps the UI clean when RSS summaries contain HTML.
  const noTags = input.replace(/<[^>]*>/g, " ");
  return noTags
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export default async function NewsPage() {
  let articles: Awaited<ReturnType<typeof getLatestNews>> = [];
  let errorMessage: string | null = null;
  try {
    articles = await getLatestNews({ limit: 100 });
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
        <div className="space-y-3">
          {articles.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-50">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {item.title}
                  </a>
                </h2>
                <span className="text-[11px] text-slate-500">
                  {item.published_at
                    ? new Date(item.published_at).toLocaleString()
                    : "—"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {item.source} · Live article
              </p>
              {item.summary && (
                <p className="mt-2 text-slate-300 line-clamp-4">
                  {stripHtml(item.summary)}
                </p>
              )}
              <div className="mt-3">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300"
                >
                  Open source →
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

