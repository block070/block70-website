import { getWalletLeaderboard, getAirdrops } from "@/lib/api";
import { WhaleActivity } from "@/components/home/whale-activity";
import { AirdropHighlights } from "@/components/home/airdrop-highlights";
import { UserDashboard } from "@/components/home/user-dashboard";
import { withTimeout } from "@/lib/with-timeout";

const FETCH_TIMEOUT_MS = 6_000;

export async function WhaleAirdropSection() {
  const [walletsResult, airdropsResult] = await Promise.allSettled([
    withTimeout(getWalletLeaderboard(), FETCH_TIMEOUT_MS),
    withTimeout(getAirdrops(), FETCH_TIMEOUT_MS),
  ]);

  const walletLeaderboard = walletsResult.status === "fulfilled" ? walletsResult.value : [];
  const walletsError = walletsResult.status === "rejected"
    ? (walletsResult.reason instanceof Error ? walletsResult.reason.message : "Unknown error")
    : null;

  const airdrops = airdropsResult.status === "fulfilled" ? airdropsResult.value : [];
  const airdropsError = airdropsResult.status === "rejected"
    ? (airdropsResult.reason instanceof Error ? airdropsResult.reason.message : "Unknown error")
    : null;

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <WhaleActivity wallets={walletLeaderboard} errorMessage={walletsError} />
      <AirdropHighlights airdrops={airdrops} errorMessage={airdropsError} />
      <UserDashboard />
    </section>
  );
}
