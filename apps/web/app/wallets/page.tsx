import { WalletLeaderboard } from "@/components/wallets/wallet-leaderboard";
import { getWalletLeaderboard } from "@/lib/api";
import type { WalletLeaderboardEntry } from "@/lib/types";

export const revalidate = 60;

export default async function WalletsPage() {
  let initialData: WalletLeaderboardEntry[] = [];

  try {
    initialData = await getWalletLeaderboard();
  } catch {
    // If the API is unavailable, let the client component show its error/empty state.
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-50">
          Smart Wallet Leaderboard
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          See which addresses are actually printing over time. Win-rate,
          realized ROI, and recent opportunity flow distilled into a single
          terminal-style view.
        </p>
      </section>

      <WalletLeaderboard initialData={initialData} />
    </div>
  );
}

