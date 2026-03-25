import Link from "next/link";

import type { HourSnapshotPayload } from "@/lib/coin-signals-types";
import { coinHrefFromSymbol } from "@/lib/coin-symbol-slugs";

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
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as HourSnapshotPayload;
  } catch {
    return null;
  }
}

type Params = { timestamp: string };

export async function generateMetadata({ params }: { params: Params }) {
  const snap = await loadSnapshot(params.timestamp);
  const label = snap
    ? new Date(snap.hourStartUnix * 1000).toISOString().slice(0, 16).replace("T", " ")
    : params.timestamp;
  return {
    title: `Crypto On the Hour · ${label} · Block70`,
    description: `Hourly clustered crypto topics for ${label} (UTC bucket).`,
  };
}

export default async function CryptoOnTheHourPage({ params }: { params: Params }) {
  const snap = await loadSnapshot(params.timestamp);

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
            Snapshot not found or indexer unavailable. Check{' '}
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
