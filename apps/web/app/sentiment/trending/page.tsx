import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

export const revalidate = 60;

export const metadata = {
  title: "Trending Sentiment · Block70",
  description: "Tokens with the strongest bullish community sentiment.",
};

type Row = {
  token_symbol: string;
  bullish_count: number;
  neutral_count: number;
  bearish_count: number;
  updated_at: string | null;
};

export default async function SentimentTrendingPage() {
  let list: Row[] = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/sentiment/trending?limit=30`, {
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
            Trending sentiment
          </h1>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Tokens with the strongest bullish community sentiment.
          </p>
        </div>
        <Link href="/sentiment" className="text-sm font-medium text-crypto-blue hover:underline">
          Leaderboard
        </Link>
      </section>

      {list.length === 0 ? (
        <p className="text-sm text-[var(--b70-text-muted)]">
          No sentiment data yet. Vote on token pages to build the leaderboard.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((row) => {
            const total = row.bullish_count + row.neutral_count + row.bearish_count;
            const pct = total > 0 ? (row.bullish_count / total) * 100 : 0;
            return (
              <li key={row.token_symbol}>
                <Link
                  href={`/coins/${row.token_symbol.toLowerCase()}`}
                  className="block rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 hover:bg-[var(--b70-border)]/30"
                >
                  <span className="font-semibold text-[var(--b70-text)]">
                    {row.token_symbol}
                  </span>
                  <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                    {row.bullish_count} bullish ({pct.toFixed(0)}%) · {total} votes
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
