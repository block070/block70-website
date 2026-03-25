import Link from "next/link";

import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";
import { listPublishedArticles } from "@/lib/server/published-articles";

/** DB is only available at runtime (e.g. Docker host network); skip prerender during `next build`. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Crypto On the Hour · Block70",
  description: "Automated hourly crypto briefs published from the Block70 content engine.",
};

export default async function CryptoHourIndexPage() {
  const pool = getCryptoHourPool();
  let articles: Awaited<ReturnType<typeof listPublishedArticles>> = [];
  let listError: string | null = null;
  if (pool) {
    try {
      articles = await listPublishedArticles(pool, 50);
    } catch (e) {
      listError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-100">Crypto On the Hour</h1>
        <p className="text-sm text-slate-400">
          Hourly ranked topics & SEO articles from the Block70 automated pipeline.
        </p>
      </header>

      {listError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200/90">
          <strong className="font-medium">Could not load articles.</strong>{" "}
          <span className="opacity-90">{listError}</span>
        </p>
      ) : null}

      {!pool ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-200/90">
          <strong className="font-medium">Database not connected.</strong> Set{" "}
          <code className="rounded bg-slate-900 px-1 text-xs">CRYPTO_HOUR_DATABASE_URL</code> (same as the
          crypto-on-the-hour Postgres) on this app to list published articles.
        </p>
      ) : null}

      {articles.length === 0 && pool && !listError ? (
        <p className="text-sm text-slate-500">No published articles yet. Run the pipeline and webhook.</p>
      ) : null}

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
        {articles.map((a) => (
          <li key={a.topic_id}>
            <Link
              href={`/crypto-hour/${a.topic_id}`}
              className="block px-4 py-3 transition hover:bg-slate-800/50"
            >
              <span className="font-medium text-slate-100">{a.title}</span>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {new Date(a.updated_at).toLocaleString()} ·{" "}
                <span className="text-slate-400">{a.topic_slug}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
