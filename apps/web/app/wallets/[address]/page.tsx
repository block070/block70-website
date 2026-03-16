import { getWalletByAddress, getWalletPerformance } from "@/lib/api";
import { notFound } from "next/navigation";

type PageProps = { params: { address: string } };

export default async function WalletAddressPage({ params }: PageProps) {
  const address = params.address;

  let wallet: Record<string, unknown> | null = null;
  let performance: Awaited<ReturnType<typeof getWalletPerformance>> | null = null;

  try {
    [wallet, performance] = await Promise.all([
      getWalletByAddress(address).catch(() => null),
      getWalletPerformance(address).catch(() => null),
    ]);
  } catch {
    // fall through to notFound if both fail
  }

  if (!wallet && !performance) notFound();

  const perf = performance ?? {
    wallet_address: address,
    chain: (wallet as any)?.chain ?? "—",
    roi: (wallet as any)?.average_roi ?? 0,
    win_rate: (wallet as any)?.win_rate ?? 0,
    token_holdings: [],
  };

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Wallet
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-400 break-all">
          {address}
        </p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-50">Performance</h2>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Chain</dt>
            <dd className="font-medium text-slate-200">{perf.chain}</dd>
          </div>
          <div>
            <dt className="text-slate-500">ROI</dt>
            <dd className="font-medium text-emerald-400">
              {((perf.roi ?? 0) * 100).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Win rate</dt>
            <dd className="font-medium text-slate-200">
              {((perf.win_rate ?? 0) * 100).toFixed(1)}%
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Token holdings</dt>
            <dd className="font-medium text-slate-200">
              {perf.token_holdings?.length ? perf.token_holdings.length : 0} tokens
            </dd>
          </div>
        </dl>
        {perf.token_holdings && perf.token_holdings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            {perf.token_holdings.map((t: { symbol: string; balance: number }) => (
              <li key={t.symbol}>
                {t.symbol}: {t.balance}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
