import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArticleMarkdown } from "@/components/crypto-hour/article-markdown";
import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";
import {
  cryptoHourArticlePath,
  getPublishedArticleBySlug,
  getPublishedArticleByTopicId,
  isUuid,
} from "@/lib/server/published-articles";

/** Same as /crypto-hour: avoid Postgres during `next build` inside Docker. */
export const dynamic = "force-dynamic";

type Params = { slug: string };

function displayMarkdown(body: string, meta: Record<string, unknown>): string {
  const display = meta.displayBody;
  if (typeof display === "string" && display.trim()) return display;
  const b = typeof body === "string" ? body : "";
  if (b.trim().toUpperCase().startsWith("META:")) {
    const nl = b.indexOf("\n");
    if (nl !== -1) return b.slice(nl + 1).trimStart();
  }
  return b;
}

async function resolveArticleRow(pool: NonNullable<ReturnType<typeof getCryptoHourPool>>, segment: string) {
  if (isUuid(segment)) {
    const byId = await getPublishedArticleByTopicId(pool, segment);
    if (byId) return byId;
  }
  return getPublishedArticleBySlug(pool, segment);
}

export async function generateMetadata({ params }: { params: Params }) {
  const segment = typeof params.slug === "string" ? params.slug.trim() : "";
  const pool = getCryptoHourPool();
  if (!pool || !segment) return { title: "Article · Block70" };
  try {
    const row = await resolveArticleRow(pool, segment);
    if (!row) return { title: "Article · Block70" };
    const desc =
      typeof row.meta?.metaDescription === "string" ? row.meta.metaDescription : undefined;
    return {
      title: `${row.title} · Crypto On the Hour · Block70`,
      description: desc ?? row.title,
    };
  } catch {
    return { title: "Article · Block70" };
  }
}

export default async function CryptoHourArticlePage({ params }: { params: Params }) {
  const segment = typeof params.slug === "string" ? params.slug.trim() : "";
  if (!segment) notFound();

  const pool = getCryptoHourPool();
  if (!pool) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-amber-200/90">
        Set <code className="text-xs">CRYPTO_HOUR_DATABASE_URL</code> to load this article.
      </div>
    );
  }

  if (isUuid(segment)) {
    const byId = await getPublishedArticleByTopicId(pool, segment);
    if (byId) redirect(cryptoHourArticlePath(byId.topic_slug));
  }

  let row: Awaited<ReturnType<typeof getPublishedArticleBySlug>>;
  try {
    row = await getPublishedArticleBySlug(pool, segment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-red-200/90">
        Database error while loading this article: <span className="opacity-90">{msg}</span>
      </div>
    );
  }
  if (!row) notFound();

  const md = displayMarkdown(row.body_markdown, row.meta);

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <nav className="text-[11px] text-slate-500">
        <Link href="/crypto-hour" className="text-blue-400 hover:text-blue-300">
          Crypto On the Hour
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-400 truncate">{row.topic_slug}</span>
      </nav>

      <header className="space-y-2 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-semibold leading-tight text-slate-50">{row.title}</h1>
        <p className="text-[11px] text-slate-500">
          Updated {new Date(row.updated_at).toLocaleString()} · Topic{" "}
          <code className="text-slate-400">{row.topic_id}</code>
        </p>
      </header>

      <ArticleMarkdown markdown={md} />

      <footer className="border-t border-slate-800 pt-4 text-[11px] text-slate-500">
        Informational only; not financial advice. Automated pipeline output may contain errors.
      </footer>
    </article>
  );
}
