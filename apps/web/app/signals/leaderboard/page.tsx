import { getSignalsLeaderboard } from "@/lib/api";
import Link from "next/link";

export const revalidate = 60;

function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export default async function SignalsLeaderboardPage() {
  let leaderboard: Awaited<ReturnType<typeof getSignalsLeaderboard>> = [];
  let error: string | null = null;

  try {
    leaderboard = await getSignalsLeaderboard({
      hours: 24,
      limit: 50,
      sort_by: "signal_strength",
    });
  } catch {
    error = "Unable to load the leaderboard. Please try again shortly.";
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Signal leaderboard</h2>
          <p className="mt-1 text-xs text-slate-400">
            Tokens ranked by signal strength, number of signals, and confidence.
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
      ) : leaderboard.length === 0 ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-8 text-center text-sm text-slate-400">
          No leaderboard data in the last 24 hours.
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leaderboard.map((row, i) => (
            <Link
              key={`${row.token_symbol}-${row.chain}-${i}`}
              href={`/signals/${encodeURIComponent(row.token_symbol || row.token_address || "-")}`}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs transition-colors hover:border-slate-700 hover:bg-slate-900/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-500">#{i + 1}</span>
                <span className="font-semibold text-slate-100">
                  {row.token_symbol || row.token_address || "—"}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>{row.signal_count} signals</span>
                <span className="text-emerald-300">
                  {formatPct(row.avg_confidence_score)} conf
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Strength {formatPct(row.avg_signal_strength)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
