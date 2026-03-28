import Link from "next/link";
import { notFound } from "next/navigation";
import { getNarrativeDetailForServer } from "@/lib/get-narratives-intelligence-server";
import { NarrativeDetailTrend } from "@/components/narratives/narrative-detail-trend";
import { clsx } from "clsx";

export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };

function sentimentStyles(s: number): { label: string; className: string } {
  if (s >= 0.2)
    return {
      label: "Bullish skew",
      className: "border-emerald-500/40 text-emerald-300",
    };
  if (s <= -0.2)
    return {
      label: "Risk-heavy",
      className: "border-rose-500/40 text-rose-300",
    };
  return {
    label: "Neutral",
    className: "border-[var(--b70-border)] text-[var(--b70-text-muted)]",
  };
}

function formatGrowthRate(g: number | null): string {
  if (g == null) return "New";
  const pct = g * 100;
  const capped = Math.max(-999, Math.min(999, pct));
  return `${capped >= 0 ? "+" : ""}${capped.toFixed(0)}%`;
}

export async function generateMetadata({ params }: PageProps) {
  let title = "Narrative · Block70";
  try {
    const d = await getNarrativeDetailForServer({ slug: params.slug });
    title = `${d.name} · Narrative intelligence`;
  } catch {
    /* keep default */
  }
  return {
    title,
    description: "Narrative detail: attention, sentiment proxy, linked opportunities, and 14d trend.",
  };
}

export default async function NarrativeDetailPage({ params }: PageProps) {
  let data;
  try {
    data = await getNarrativeDetailForServer({
      slug: params.slug,
      opportunityLimit: 100,
    });
  } catch {
    notFound();
  }

  const sent = sentimentStyles(data.sentiment);

  return (
    <div className="space-y-10 pb-16 pt-2">
      <nav className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/narratives" className="text-[var(--b70-crypto-blue)] hover:underline">
          Narratives
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[var(--b70-text)]">{data.name}</span>
      </nav>

      <header className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Narrative drill-down
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">{data.name}</h1>
          <span
            className={clsx(
              "rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide",
              sent.className,
            )}
          >
            {sent.label}
          </span>
        </div>
        <p className="max-w-3xl text-sm text-[var(--b70-text-muted)]">{data.description ?? "—"}</p>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-[var(--b70-text-muted)]">7d attention</p>
            <p className="font-[family-name:var(--font-jetbrains)] text-lg text-[var(--b70-text)]">
              {data.attention.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[var(--b70-text-muted)]">Growth (7d vs prior)</p>
            <p
              className={clsx(
                "font-[family-name:var(--font-jetbrains)] text-lg",
                data.growth_rate === null
                  ? "text-sky-400/95"
                  : data.growth_rate >= 0
                    ? "text-emerald-400"
                    : "text-rose-400",
              )}
            >
              {formatGrowthRate(data.growth_rate)}
            </p>
          </div>
          <div>
            <p className="text-[var(--b70-text-muted)]">Sentiment proxy</p>
            <p className="font-[family-name:var(--font-jetbrains)] text-lg text-[var(--b70-text)]">
              {data.sentiment.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[var(--b70-text-muted)]">Trend score</p>
            <p className="font-[family-name:var(--font-jetbrains)] text-lg text-[var(--b70-text)]">
              {(data.trend_score * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </header>

      {data.related_symbols.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--b70-text)]">Related markets</h2>
          <div className="flex flex-wrap gap-2">
            {data.related_symbols.map((sym) => (
              <Link
                key={sym}
                href={`/coins/${encodeURIComponent(sym)}`}
                className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-sm font-medium text-[var(--b70-crypto-blue)] hover:border-[var(--b70-crypto-blue)]/50"
              >
                {sym}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Attention (14d)</h2>
        <NarrativeDetailTrend dailySeries={data.daily_series} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Matching opportunities</h2>
        {data.opportunities.length === 0 ? (
          <p className="text-sm text-[var(--b70-text-muted)]">
            No narrative-type opportunities mention this name in title or summary.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--b70-border)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--b70-border)] bg-[var(--b70-bg)] text-[11px] uppercase tracking-wide text-[var(--b70-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Symbol</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Detected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--b70-border)]/80 text-[var(--b70-text)]">
                {data.opportunities.map((o) => (
                  <tr key={o.id} className="hover:bg-[var(--b70-bg)]/50">
                    <td className="px-4 py-3">
                      <span className="font-medium">{o.title}</span>
                      {o.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--b70-text-muted)]">{o.summary}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-jetbrains)] text-xs">
                      {o.asset_symbol ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-[family-name:var(--font-jetbrains)] text-xs">
                      {o.total_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--b70-text-muted)]">
                      {o.detected_at
                        ? new Date(o.detected_at).toLocaleDateString()
                        : new Date(o.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[10px] leading-relaxed text-[var(--b70-text-muted)]">
        Linking rule: narrative name substring match on narrative-type opportunity title or summary.
        Sentiment and attention are derived from those rows—not a standalone NLP feed.
      </p>
    </div>
  );
}
