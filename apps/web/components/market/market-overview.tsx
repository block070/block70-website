import { Card, CardHeader } from "@/components/ui/card";

type MarketOverviewProps = {
  totalMarketCap?: number;
  volume24h?: number;
  btcDominance?: number;
  ethDominance?: number;
};

function formatCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export function MarketOverview({
  totalMarketCap = 2_400_000_000_000,
  volume24h = 80_000_000_000,
  btcDominance = 52.5,
  ethDominance = 17.2,
}: MarketOverviewProps) {
  return (
    <Card>
      <CardHeader title="Market overview" subtitle="Global crypto metrics" />
      <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Market cap
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {formatCompact(totalMarketCap)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            24h volume
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {formatCompact(volume24h)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            BTC dominance
          </p>
          <p className="mt-1 text-lg font-semibold text-blue-400">
            {btcDominance.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            ETH dominance
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-300">
            {ethDominance.toFixed(1)}%
          </p>
        </div>
      </div>
    </Card>
  );
}
