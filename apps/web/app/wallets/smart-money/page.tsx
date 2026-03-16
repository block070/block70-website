import Link from "next/link";
import { getWalletLeaderboard, getOpportunities } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { WhaleFeed } from "@/components/wallets/whale-feed";

export const revalidate = 60;

function formatUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default async function SmartMoneyPage() {
  let wallets: Awaited<ReturnType<typeof getWalletLeaderboard>> = [];
  let opportunities: Awaited<ReturnType<typeof getOpportunities>> = [];

  try {
    const [w, o] = await Promise.all([
      getWalletLeaderboard(),
      getOpportunities(),
    ]);
    wallets = w;
    opportunities = o.filter((opp) => opp.type === "wallet");
  } catch {
    // use empty
  }

  const topTraders = wallets.slice(0, 10);
  const recentWalletOpps = opportunities.slice(0, 5);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-50">
          Smart money dashboard
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Top traders, recent trades, top tokens accumulated, and profit leaderboard.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Profit leaderboard" subtitle="By total profit (USD)" />
          <div className="p-4">
            <WhaleFeed wallets={topTraders} maxItems={10} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Top traders" subtitle="Win rate & ROI" />
          <ul className="p-4 space-y-2">
            {topTraders.slice(0, 5).map((w, i) => (
              <li
                key={w.wallet_address}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
              >
                <span className="font-mono text-slate-300 truncate max-w-[140px]">
                  {w.wallet_address.slice(0, 8)}…
                </span>
                <div className="flex gap-3 text-emerald-400">
                  <span>{(w.win_rate * 100).toFixed(0)}% win</span>
                  <span>{formatUsd(w.total_profit_usd)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Recent wallet opportunities"
          subtitle="Smart wallet–driven plays"
          action={
            <Link
              href="/opportunities?type=wallet"
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          }
        />
        <div className="p-4">
          {recentWalletOpps.length === 0 ? (
            <p className="text-xs text-slate-500">
              No recent wallet opportunities. They will appear as the engine detects activity.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentWalletOpps.map((opp) => (
                <li key={opp.id}>
                  <Link
                    href={`/opportunities/${opp.slug}`}
                    className="block rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    <span className="font-medium">{opp.title}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      Score {((opp.total_score ?? 0) * 100).toFixed(0)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
