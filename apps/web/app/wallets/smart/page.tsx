import Link from "next/link";
import { getSmartWallets, getWalletLeaderboard } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";

export const revalidate = 60;

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default async function SmartWalletsPage() {
  let smart: Awaited<ReturnType<typeof getSmartWallets>> = [];
  let leaderboard: Awaited<ReturnType<typeof getWalletLeaderboard>> = [];

  try {
    [smart, leaderboard] = await Promise.all([
      getSmartWallets({ limit: 100 }),
      getWalletLeaderboard(),
    ]);
  } catch {
    // use empty
  }

  const wallets = smart.length > 0 ? smart : leaderboard.map((w) => ({
    wallet_address: w.wallet_address,
    chain: "solana",
    reputation_score: w.win_rate,
    profitability_score: w.average_roi ?? 0,
    created_at: null as string | null,
  }));
  const topWallets = wallets.slice(0, 15);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Smart wallet dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Top performing wallets by ROI, win rate, and activity. Track
          performance and token holdings.
        </p>
      </section>

      <Card>
        <CardHeader
          title="Top performing wallets"
          subtitle="By profitability and reputation score"
        />
        <div className="p-4">
          <ul className="space-y-2">
            {topWallets.map((w, i) => (
              <li key={w.wallet_address}>
                <Link
                  href={`/wallets/solana/${encodeURIComponent(w.wallet_address)}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs hover:bg-slate-800"
                >
                  <span className="font-mono text-slate-300 truncate max-w-[180px]">
                    {w.wallet_address.slice(0, 12)}…
                  </span>
                  <div className="flex gap-3 text-emerald-400">
                    {"profitability_score" in w && (
                      <span>{(Number((w as any).profitability_score) * 100).toFixed(0)}% ROI</span>
                    )}
                    {"average_roi" in w && (
                      <span>{(Number((w as any).average_roi) * 100).toFixed(0)}% ROI</span>
                    )}
                    {"win_rate" in w && (
                      <span>{(Number((w as any).win_rate) * 100).toFixed(0)}% win</span>
                    )}
                    {"reputation_score" in w && (
                      <span>rep {(Number((w as any).reputation_score) * 100).toFixed(0)}%</span>
                    )}
                    {"total_profit_usd" in w && (
                      <span>{formatUsd(Number((w as any).total_profit_usd))}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        Click a wallet to view performance (ROI, win rate, token holdings).
      </p>
    </div>
  );
}
