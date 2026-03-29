import { CopyTradeWatchlistPanel } from "@/components/smartwallets/copy-trade-watchlist-panel";

export const metadata = {
  title: "Whale watchlist · Block70",
  description: "Follow smart money wallets for monitoring—informational only, not trade execution.",
};

export default function SmartwalletsWatchlistPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[var(--b70-text)]">Watchlist</h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Copy-trade mode: monitor addresses you follow. No automatic orders.
        </p>
      </header>
      <CopyTradeWatchlistPanel />
    </div>
  );
}
