import { SEEDED_NEWS } from "@/lib/news-seed";
import { isDemoMode } from "@/lib/demo";

export const metadata = {
  title: "News · Block70",
  description:
    "Curated macro and infrastructure stories that matter for Block70 operators.",
};

export default function NewsPage() {
  const demo = isDemoMode();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">News</h1>
        <p className="text-sm text-slate-400">
          A curated macro surface for ecosystem moves, restaking, perps, and
          infra shifts that Block70 tracks most closely.
        </p>
        {demo && (
          <p className="text-[11px] text-amber-300">
            Demo dataset: headlines and summaries are seeded examples, not a
            live news feed.
          </p>
        )}
      </header>
      <div className="space-y-3">
        {SEEDED_NEWS.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-50">
                {item.title}
              </h2>
              <span className="text-[11px] text-slate-500">
                {new Date(item.published_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {item.source} · {item.category}
            </p>
            <p className="mt-2 text-slate-300">{item.summary}</p>
            {item.tags && item.tags.length > 0 && (
              <p className="mt-2 text-[10px] text-slate-500">
                Tags:{" "}
                <span className="font-mono text-slate-300">
                  {item.tags.join(", ")}
                </span>
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

