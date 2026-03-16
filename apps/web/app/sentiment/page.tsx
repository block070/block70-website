import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

export const revalidate = 60;

export const metadata = {
  title: "Sentiment Leaderboard · Block70",
  description: "Rank tokens by bullish community sentiment.",
};

type Row = {
  rank: number;
  token_symbol: string;
  bullish_count: number;
  neutral_count: number;
  bearish_count: number;
  updated_at: string | null;
};

export default async function SentimentLeaderboardPage() {
  let list: Row[] = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/sentiment/leaderboard?limit=50`, {
      cache: "no-store",
    });
    if (res.ok) list = await res.json();
  } catch {
    // empty
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--b70-text)]">
            Sentiment leaderboard
          </h1>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Tokens ranked by bullish sentiment votes.
          </p>
        </div>
        <Link href="/sentiment/trending" className="text-sm font-medium text-crypto-blue hover:underline">
          Trending
        </Link>
      </section>

      {list.length === 0 ? (
        <p className="text-sm text-[var(--b70-text-muted)]">
          No sentiment data yet. Vote on token pages to build the leaderboard.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--b70-border)] text-left text-[var(--b70-text-muted)]">
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Token</th>
                <th className="px-4 py-3 font-medium text-right">Bullish</th>
                <th className="px-4 py-3 font-medium text-right">Neutral</th>
                <th className="px-4 py-3 font-medium text-right">Bearish</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={row.token_symbol}
                  className="border-b border-[var(--b70-border)]/50 last:border-0"
                >
                  <td className="px-4 py-2 font-medium">{row.rank}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/coins/${row.token_symbol.toLowerCase()}`}
                      className="font-medium text-crypto-blue hover:underline"
                    >
                      {row.token_symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right text-emerald-400">{row.bullish_count}</td>
                  <td className="px-4 py-2 text-right">{row.neutral_count}</td>
                  <td className="px-4 py-2 text-right text-rose-400">{row.bearish_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
