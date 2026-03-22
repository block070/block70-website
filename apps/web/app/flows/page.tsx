import Link from "next/link";
import { getFlows, getFlowsTrending } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { CapitalFlowChart } from "@/components/flows/capital-flow-chart";
import { withTimeout } from "@/lib/with-timeout";

export const revalidate = 60;

export default async function CapitalFlowPage() {
  let flows: Awaited<ReturnType<typeof getFlows>> = [];
  let trending: Awaited<ReturnType<typeof getFlowsTrending>> = [];

  try {
    [flows, trending] = await Promise.all([
      withTimeout(getFlows({ hours: 168, limit: 50 }), 8_000),
      withTimeout(getFlowsTrending({ hours: 24, limit: 20 }), 8_000),
    ]);
  } catch {
    // use empty
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Capital flow tracker
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Where is the money flowing? Movement between tokens and chains from
          wallet transactions, DEX swaps, and bridge transfers.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Flow network"
            subtitle="Source → destination (last 24h trending)"
          />
          <div className="p-4">
            <CapitalFlowChart flows={trending} maxNodes={12} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Trending flows"
            subtitle="By total amount (24h)"
          />
          <div className="p-4">
            {trending.length === 0 ? (
              <p className="text-xs text-slate-500">
                No trending flows yet. Flows appear as the engine ingests
                transactions and swaps.
              </p>
            ) : (
              <ul className="space-y-2">
                {trending.slice(0, 10).map((t, i) => (
                  <li
                    key={`${t.source_asset}-${t.destination_asset}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-slate-300">
                      {t.source_asset} → {t.destination_asset}
                    </span>
                    <span className="text-emerald-400">
                      {t.flow_count ?? 0} flows · {formatAmount(t.total_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Recent flows"
          subtitle="Latest capital movements (7d)"
          action={
            <Link
              href="/opportunities"
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Opportunities
            </Link>
          }
        />
        <div className="p-4">
          {flows.length === 0 ? (
            <p className="text-xs text-slate-500">
              No flows recorded yet. Data is populated by the capital flow
              engine from wallet, DEX, and bridge activity.
            </p>
          ) : (
            <ul className="space-y-2">
              {flows.slice(0, 15).map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                >
                  <span className="font-mono text-slate-300">
                    {f.source_asset} → {f.destination_asset}
                  </span>
                  <span className="text-slate-400">
                    {formatAmount(f.amount)} · {f.chain}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function formatAmount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}
