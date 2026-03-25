import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import type { HourSnapshotPayload } from "@/lib/coin-signals-types";
import { ArticleMarkdown } from "@/components/crypto-hour/article-markdown";
import { formatCryptoHourOnTheHour } from "@/lib/crypto-hour-dates";
import { coinHrefFromSymbol } from "@/lib/coin-symbol-slugs";
import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";
import {
  cryptoHourArticlePath,
  getPublishedArticleBySlug,
  getPublishedArticleByTopicId,
  isUuid,
} from "@/lib/server/published-articles";

export const dynamic = "force-dynamic";

type Params = { segment: string };

function siteOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL)
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function loadSnapshot(timestamp: string): Promise<HourSnapshotPayload | null> {
  const hour = parseInt(timestamp, 10);
  if (!Number.isFinite(hour) || hour <= 0) return null;
  try {
    const res = await fetch(`${siteOrigin()}/api/crypto-on-the-hour/${hour}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as HourSnapshotPayload;
  } catch {
    return null;
  }
}

function isNumericHourSegment(s: string): boolean {
  return /^\d+$/.test(s);
}

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

async function resolveArticleRow(
  pool: NonNullable<ReturnType<typeof getCryptoHourPool>>,
  segment: string,
) {
  if (isUuid(segment)) {
    const byId = await getPublishedArticleByTopicId(pool, segment);
    if (byId) return byId;
  }
  return getPublishedArticleBySlug(pool, segment);
}

export async function generateMetadata({ params }: { params: Params }) {
  const segment = typeof params.segment === "string" ? params.segment.trim() : "";

  if (isNumericHourSegment(segment)) {
    const snap = await loadSnapshot(segment);
    const label = snap
      ? new Date(snap.hourStartUnix * 1000).toISOString().slice(0, 16).replace("T", " ")
      : segment;
    return {
      title: `Crypto On the Hour · ${label} · Block70`,
      description: `Hourly clustered crypto topics for ${label} (UTC bucket).`,
    };
  }

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

export default async function CryptoOnTheHourSegmentPage({ params }: { params: Params }) {
  const segment = typeof params.segment === "string" ? params.segment.trim() : "";
  if (!segment) notFound();

  if (isNumericHourSegment(segment)) {
    const snap = await loadSnapshot(segment);

    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <nav className="text-[11px] text-slate-500">
          <Link href="/coins" className="text-blue-400 hover:text-blue-300">
            Coins
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-400">Crypto On the Hour</span>
        </nav>

        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-100">Crypto On the Hour</h1>
          {snap ? (
            <p className="text-sm text-slate-400">
              Topics last updated between{" "}
              <time dateTime={new Date(snap.hourStartUnix * 1000).toISOString()}>
                {new Date(snap.hourStartUnix * 1000).toUTCString()}
              </time>{" "}
              and{" "}
              <time dateTime={new Date(snap.hourEndUnix * 1000).toISOString()}>
                {new Date(snap.hourEndUnix * 1000).toUTCString()}
              </time>{" "}
              (UTC buckets).
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Snapshot not found or indexer unavailable. Check{" "}
              <code className="text-slate-400">CRYPTO_ON_THE_HOUR_URL</code>.
            </p>
          )}
        </header>

        {snap && snap.topics.length > 0 ? (
          <ol className="space-y-3">
            {snap.topics.map((t, idx) => (
              <li
                key={t.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 tabular-nums text-[11px] text-slate-500">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium text-slate-100">{t.headline}</p>
                    <div className="flex flex-wrap gap-2">
                      {t.mentionedAssets.map((a) => (
                        <Link
                          key={a}
                          href={coinHrefFromSymbol(a)}
                          className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:border-emerald-500/40"
                        >
                          {a}
                        </Link>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Rank {t.rankScore.toFixed(2)} · slug{" "}
                      <span className="text-slate-400">{t.slug}</span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">No topics in this hour window.</p>
        )}

        <section className="rounded-lg border border-dashed border-slate-700 p-4 text-[11px] text-slate-500">
          <p className="font-medium text-slate-400">Example layout</p>
          <p className="mt-1">
            Hour pages list clustered headlines from the indexer for that UTC hour. Wire your CMS
            or SEO article body here when the website publisher pushes full narratives.
          </p>
        </section>
      </div>
    );
  }

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
        <Link href="/crypto-on-the-hour" className="text-blue-400 hover:text-blue-300">
          Crypto On the Hour
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-400 truncate">{row.topic_slug}</span>
      </nav>

      <header className="space-y-2 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-semibold leading-tight text-slate-50">{row.title}</h1>
        <p className="text-[11px] text-slate-500">
          Updated {formatCryptoHourOnTheHour(new Date(row.updated_at))} · Topic{" "}
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
