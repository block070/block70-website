import { getNarrativesList, getTrendingNarratives } from "@/lib/api";

export const metadata = {
  title: "Narratives · Block70 Crypto Data",
  description:
    "Trending crypto narratives and related tokens from the narrative engine.",
};

export const revalidate = 60;

export default async function NarrativesPage() {
  let list: Awaited<ReturnType<typeof getNarrativesList>> = [];
  let trendingOpps: Awaited<ReturnType<typeof getTrendingNarratives>> = [];

  try {
    [list, trendingOpps] = await Promise.all([
      getNarrativesList({ limit: 50 }),
      getTrendingNarratives(),
    ]);
  } catch {
    // use empty
  }

  const hasNarratives = list.length > 0;
  const narratives = hasNarratives
    ? list
    : [
        {
          id: 0,
          name: "L2 scaling and rollups",
          description:
            "Capital is rotating between L2 ecosystems as fees compress and UX improves.",
          trend_score: 0.8,
          created_at: null as string | null,
        },
        {
          id: 1,
          name: "Solana degen + microcaps",
          description:
            "Orderflow and meme liquidity keep cycling through Solana.",
          trend_score: 0.7,
          created_at: null as string | null,
        },
        {
          id: 2,
          name: "ETH restaking and security markets",
          description:
            "Protocols experimenting with restaking primitives.",
          trend_score: 0.5,
          created_at: null as string | null,
        },
      ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Narrative explorer
        </h1>
        <p className="text-sm text-slate-400">
          Trending narratives from token performance, news, and social signals.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {narratives.map((n) => (
          <article
            key={n.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-50">
                {n.name}
              </h2>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  n.trend_score >= 0.6
                    ? "border-emerald-500/40 text-emerald-300"
                    : n.trend_score >= 0.3
                      ? "border-slate-500/40 text-slate-400"
                      : "border-slate-600/40 text-slate-500"
                }`}
              >
                {(n.trend_score * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-slate-400">{n.description ?? "—"}</p>
            {trendingOpps.length > 0 && !hasNarratives && (
              <div className="mt-3 border-t border-slate-800 pt-3 text-[10px] text-slate-500">
                {trendingOpps.filter((o) => o.asset_symbol).length} related
                opportunities
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
