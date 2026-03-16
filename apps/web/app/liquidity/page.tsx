import { getTopPools } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";

export const revalidate = 60;

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default async function LiquidityPage() {
  let pools: Awaited<ReturnType<typeof getTopPools>> = [];

  try {
    pools = await getTopPools(50);
  } catch {
    // If the API is not available yet, show an empty state instead of erroring.
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Liquidity pools
        </h1>
        <p className="text-sm text-slate-400">
          Top pools by on-chain liquidity. Data comes from the Block70
          liquidity engine when available; otherwise this page will be empty.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Top pools"
          subtitle="Ranked by liquidity"
        />
        <div className="p-4">
          {pools.length === 0 ? (
            <p className="text-xs text-slate-500">
              No pool data yet. Pools will appear once the liquidity engine has
              ingested on-chain data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pair</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Liquidity
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      24h volume
                    </th>
                    <th className="px-3 py-2 font-medium">DEX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pools.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-slate-200">{p.pair}</td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {formatUsd(p.liquidity_usd)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {formatUsd(p.volume_24h)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{p.dex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

