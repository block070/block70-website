import { getSignalsTrending } from "@/lib/api";
import Link from "next/link";

export const revalidate = 60;

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SignalsTrendingPage() {
  let trending: Awaited<ReturnType<typeof getSignalsTrending>> = [];
  let error: string | null = null;

  try {
    trending = await getSignalsTrending({ hours: 24, limit: 50 });
  } catch {
    error = "Unable to load trending signals. Please try again shortly.";
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Trending signals</h2>
          <p className="mt-1 text-xs text-slate-400">
            Tokens ranked by signal activity (count, confidence, trend).
          </p>
        </div>
        <Link
          href="/signals"
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
        >
          ← Feed
        </Link>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}
        </section>
      ) : trending.length === 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm text-slate-400">
          No trending data in the last 24 hours.
        </section>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Token</th>
                <th className="pb-2 pr-4 font-medium">Chain</th>
                <th className="pb-2 pr-4 font-medium">Signal count</th>
                <th className="pb-2 pr-4 font-medium">Confidence</th>
                <th className="pb-2 pr-4 font-medium">Strength</th>
                <th className="pb-2 pr-4 font-medium">Trend</th>
                <th className="pb-2 font-medium">Latest</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {trending.map((row, i) => (
                <tr
                  key={`${row.token_symbol}-${row.chain}-${i}`}
                  className="border-b border-slate-800/80 hover:bg-slate-900/50"
                >
                  <td className="py-3 pr-4 text-slate-500">{i + 1}</td>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/signals/${encodeURIComponent(row.token_symbol || row.token_address || "-")}`}
                      className="font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      {row.token_symbol || row.token_address || "—"}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-slate-400">{row.chain || "—"}</td>
                  <td className="py-3 pr-4 font-medium">{row.signal_count}</td>
                  <td className="py-3 pr-4 text-emerald-300">
                    {formatPct(row.avg_confidence_score)}
                  </td>
                  <td className="py-3 pr-4 text-slate-300">
                    {formatPct(row.avg_signal_strength)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        row.trend_direction === "up"
                          ? "text-emerald-400"
                          : row.trend_direction === "down"
                            ? "text-rose-400"
                            : "text-slate-500"
                      }
                    >
                      {row.trend_direction}
                    </span>
                  </td>
                  <td className="py-3 text-slate-500">
                    {formatTime(row.latest_signal_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
