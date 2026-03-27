import Link from "next/link";
import { CoinsMarketScanner } from "@/components/market/coins-market-scanner";
import { MarketStats } from "@/components/market/market-stats";
import { getMarketSummary } from "@/lib/api";
import { withTimeout } from "@/lib/with-timeout";

export const revalidate = 60;

export const metadata = {
  title: "Trader radar · Block70",
  description:
    "Virtualized market scanner: price, volume, market cap, tags, and smart score. Filter, sort, and drill in with chart + signals.",
};

export default async function CoinsPage() {
  const FETCH_TIMEOUT_MS = 10_000;
  let marketSummary: Awaited<ReturnType<typeof getMarketSummary>> | null = null;
  try {
    marketSummary = await withTimeout(getMarketSummary(0), FETCH_TIMEOUT_MS);
  } catch {
    marketSummary = null;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">Trader radar</h1>
        <p className="max-w-2xl text-sm text-[var(--b70-text-muted)]">
          Data from <code className="rounded bg-[var(--b70-card)] px-1 text-xs">GET /api/coins</code>.
        </p>
      </header>

      <MarketStats summary={marketSummary} />

      <CoinsMarketScanner />

      <p className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/categories" className="text-[var(--b70-crypto-blue)] hover:underline">
          Categories
        </Link>
        {" · "}
        <Link href="/signals" className="text-[var(--b70-crypto-blue)] hover:underline">
          Signals
        </Link>
        {" · "}
        <Link href="/narratives" className="text-[var(--b70-crypto-blue)] hover:underline">
          Narratives
        </Link>
      </p>
    </div>
  );
}
