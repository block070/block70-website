import Link from "next/link";
import { AlertCard } from "@/components/wallets/alert-card";
import { WalletTable } from "@/components/wallets/wallet-table";
import { smartAlerts } from "@/data/alerts";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";

export const metadata = {
  title: "Crypto Whale Tracker – Smart Money Wallets | Block70",
  description:
    "Track smart money wallets across BTC, ETH, and SOL. Preview live whale intelligence and unlock premium wallet analytics on Block70.",
};

export default async function WalletsPage() {
  return (
    <div className="space-y-8 pb-20">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
        <h1 className="text-2xl font-semibold text-slate-50">Smart Money Intelligence</h1>
        <p className="mt-2 text-sm text-slate-300">Track the wallets moving crypto markets</p>
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Unlock Smart Money
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Live Preview</h2>
          <span className="text-xs text-slate-500">Top 5 wallets visible</span>
        </div>
        <WalletTable
          wallets={smartMoneyWallets}
          previewLocked={true}
          previewCount={5}
          showLockedRows={true}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Alert Feed (Limited)</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {smartAlerts.slice(0, 5).map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-100">Locked Features</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Full leaderboard",
            "Wallet analytics",
            "Token signals",
            "Alerts",
            "Copy trading insights",
          ].map((feature) => (
            <div key={feature} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
              <span className="mr-2">[LOCK]</span>
              {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <h3 className="text-lg font-semibold text-slate-50">Unlock 300+ Smart Money Wallets</h3>
        <p className="mt-1 text-sm text-slate-300">Premium plan placeholder: $39/month</p>
        <Link
          href="/register"
          className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Start Free Trial
        </Link>
      </section>

      <section className="text-center">
        <p className="text-sm text-slate-400">Follow capital, not noise</p>
      </section>

      <div className="fixed bottom-4 left-1/2 z-40 w-[min(560px,90vw)] -translate-x-1/2">
        <Link
          href="/login"
          className="block rounded-full border border-emerald-400/50 bg-slate-900/95 px-5 py-3 text-center text-sm font-semibold text-emerald-300 shadow-lg backdrop-blur"
        >
          Unlock Smart Money Dashboard
        </Link>
      </div>
    </div>
  );
}

