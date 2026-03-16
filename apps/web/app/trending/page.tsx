import { CoinTable } from "@/components/market/coin-table";
import { TRENDING_COINS } from "@/lib/crypto-mock";

export const metadata = {
  title: "Trending · Block70 Crypto Data",
  description:
    "Mock trending coins by volume, momentum, and Block70 narrative weighting.",
};

export default function TrendingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
        <p className="text-sm text-slate-400">
          A quick read on what&apos;s moving, designed to be overlaid with
          Block70&apos;s alpha signals later.
        </p>
      </header>
      <CoinTable coins={TRENDING_COINS} />
    </div>
  );
}

