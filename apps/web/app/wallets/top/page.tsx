import Link from "next/link";
import { getWalletLeaderboard } from "@/lib/api";

export const revalidate = 60;

export const metadata = {
  title: "Smart Wallet Leaderboard · Block70",
  description: "Rank wallets by profitability, win rate, and total profit. Block70 smart money leaderboard.",
};

export default async function WalletsTopPage() {
  let entries: Awaited<ReturnType<typeof getWalletLeaderboard>> = [];
  try {
    entries = await getWalletLeaderboard();
  } catch {
    // empty
  }
  const byProfit = [...entries].sort(
    (a, b) => (b.total_profit_usd ?? 0) - (a.total_profit_usd ?? 0),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
            Smart wallet leaderboard
          </h1>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Ranked by profitability (total profit USD) and win rate.
          </p>
        </div>
        <Link
          href="/wallets"
          className="text-sm font-medium text-crypto-blue hover:underline"
        >
          ← Wallets
        </Link>
      </section>

      {byProfit.length === 0 ? (
        <p className="text-sm text-[var(--b70-text-muted)]">
          No wallet leaderboard data yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--b70-border)] text-left text-[var(--b70-text-muted)]">
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium text-right">Win rate</th>
                <th className="px-4 py-3 font-medium text-right">Avg ROI</th>
                <th className="px-4 py-3 font-medium text-right">Total profit (USD)</th>
              </tr>
            </thead>
            <tbody>
              {byProfit.slice(0, 50).map((w, i) => (
                <tr
                  key={w.wallet_address}
                  className="border-b border-[var(--b70-border)]/50 last:border-0"
                >
                  <td className="px-4 py-2 font-medium text-[var(--b70-text)]">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/wallets/${encodeURIComponent(w.wallet_address)}`}
                      className="font-mono text-xs text-crypto-blue hover:underline"
                    >
                      {w.wallet_address.slice(0, 8)}…{w.wallet_address.slice(-6)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {w.win_rate != null ? `${(w.win_rate * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {w.average_roi != null ? `${(w.average_roi * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-[var(--b70-text)]">
                    {w.total_profit_usd != null
                      ? `$${w.total_profit_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : "—"}
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
