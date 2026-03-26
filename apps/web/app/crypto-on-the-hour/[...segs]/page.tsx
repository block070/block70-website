import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import type { HourSnapshotPayload } from "@/lib/coin-signals-types";
import { ArticleMarkdown } from "@/components/crypto-hour/article-markdown";
import { CryptoHourDashboard } from "@/components/crypto-hour/crypto-hour-dashboard";
import { formatCryptoHourOnTheHour } from "@/lib/crypto-hour-dates";
import { coinHrefFromSymbol } from "@/lib/coin-symbol-slugs";
import { pathForChicagoHour, pathForDay, pathForMonth, parseCohSegments } from "@/lib/crypto-hour-routes";
import { defaultHourForChicagoDay, loadHourDashboard } from "@/lib/server/crypto-hour-dashboard-data";
import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";
import {
  cryptoHourArticlePath,
  getPublishedArticleBySlug,
  getPublishedArticleByTopicId,
  isUuid,
} from "@/lib/server/published-articles";

export const dynamic = "force-dynamic";

type Params = { segs?: string[] };

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

export async function generateMetadata({ params }: { params: Params }) {
  const segs = params.segs ?? [];
  const parsed = parseCohSegments(segs);
  if (!parsed) return { title: "Crypto On The Hour · Block70" };

  if (parsed.kind === "article") {
    const pool = getCryptoHourPool();
    if (!pool) return { title: "Article · Block70" };
    try {
      const row = isUuid(parsed.slug)
        ? await getPublishedArticleByTopicId(pool, parsed.slug)
        : await getPublishedArticleBySlug(pool, parsed.slug);
      if (!row) return { title: "Article · Block70" };
      const desc =
        typeof row.meta?.metaDescription === "string" ? row.meta.metaDescription : undefined;
      return {
        title: `${row.title} · Crypto On The Hour · Block70`,
        description: desc ?? row.title,
      };
    } catch {
      return { title: "Article · Block70" };
    }
  }

  if (parsed.kind === "legacyNumericHour") {
    const snap = await loadSnapshot(parsed.n);
    const label = snap
      ? new Date(snap.hourStartUnix * 1000).toISOString().slice(0, 16).replace("T", " ")
      : parsed.n;
    return {
      title: `Crypto On The Hour · ${label} · Block70`,
      description: `Hourly snapshot ${label}.`,
    };
  }

  if (parsed.kind === "hour") {
    return {
      title: `Intel · ${parsed.year}-${parsed.month}-${parsed.day} ${parsed.hour}:${String(parsed.minute).padStart(2, "0")} CT · Block70`,
      description: "Hourly crypto intelligence dashboard.",
    };
  }

  return { title: "Crypto On The Hour · Block70" };
}

function CalendarMonthGrid({ y, m }: { y: number; m: number }) {
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
        <div key={w} className="py-1 font-medium text-slate-500">
          {w}
        </div>
      ))}
      {cells.map((d, i) =>
        d == null ? (
          <div key={`e-${i}`} className="py-2" />
        ) : (
          <Link
            key={d}
            href={pathForDay(y, m, d)}
            className="rounded-md border border-transparent py-2 text-slate-200 hover:border-emerald-600/40 hover:bg-slate-800/50"
          >
            {d}
          </Link>
        ),
      )}
    </div>
  );
}

export default async function CryptoOnTheHourCatchAll({ params }: { params: Params }) {
  const segs = params.segs ?? [];
  if (!segs.length) notFound();

  const parsed = parseCohSegments(segs);
  if (!parsed) notFound();

  if (parsed.kind === "year") {
    const y = parsed.year;
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-slate-200">
        <h1 className="text-xl font-semibold text-slate-100">Crypto On The Hour · {y}</h1>
        <p className="text-sm text-slate-400">Choose a month (US Central).</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            return (
              <li key={m}>
                <Link
                  href={pathForMonth(y, m)}
                  className="block rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-center text-sm hover:border-emerald-600/40"
                >
                  {new Date(y, i, 1).toLocaleString("en-US", { month: "long" })}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (parsed.kind === "month") {
    const { year, month } = parsed;
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8 text-slate-200">
        <nav className="text-[11px] text-slate-500">
          <Link href="/crypto-on-the-hour" className="text-blue-400 hover:text-blue-300">
            Hub
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={pathForMonth(year, month)} className="text-slate-400">
            {month}/{year}
          </Link>
        </nav>
        <h1 className="text-xl font-semibold text-slate-100">
          {new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
        </h1>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <CalendarMonthGrid y={year} m={month} />
        </div>
      </div>
    );
  }

  if (parsed.kind === "day") {
    const { year, month, day } = parsed;
    const h = defaultHourForChicagoDay(year, month, day);
    redirect(pathForChicagoHour(year, month, day, h, 0));
  }

  if (parsed.kind === "hour") {
    const pool = getCryptoHourPool();
    if (!pool) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-amber-200/90">
          Set <code className="text-xs">CRYPTO_HOUR_DATABASE_URL</code> to load the intelligence hub.
        </div>
      );
    }
    const { year, month, day, hour, minute } = parsed;
    const bundle = await loadHourDashboard(pool, year, month, day, hour);
    return (
      <CryptoHourDashboard
        intel={bundle.intel}
        articles={bundle.articles}
        nav={bundle.nav}
      />
    );
  }

  if (parsed.kind === "legacyNumericHour") {
    const snap = await loadSnapshot(parsed.n);
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
                  <span className="mt-0.5 tabular-nums text-[11px] text-slate-500">#{idx + 1}</span>
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

  const segment = parsed.slug;
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
        <span className="truncate text-slate-400">{row.topic_slug}</span>
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
