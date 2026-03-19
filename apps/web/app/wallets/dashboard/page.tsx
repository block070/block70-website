import { smartAlerts } from "@/data/alerts";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";
import { smartTokens } from "@/data/tokens";
import { SmartMoneyDashboard } from "@/components/wallets/smart-money-dashboard";

export const metadata = {
  title: "Smart Money Dashboard | Block70",
  description: "Premium smart wallet leaderboard, token flows, and whale alerts.",
};

export default function WalletsDashboardPage() {
  return (
    <div className="space-y-4">
      <section>
        <h1 className="text-xl font-semibold text-slate-50">Smart Money Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track conviction wallets across BTC, ETH, and SOL with high-signal alerts.
        </p>
      </section>
      <SmartMoneyDashboard wallets={smartMoneyWallets} alerts={smartAlerts} tokens={smartTokens} />
    </div>
  );
}

