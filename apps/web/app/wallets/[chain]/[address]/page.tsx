import Link from "next/link";
import { notFound } from "next/navigation";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";
import { TokenChip } from "@/components/wallets/token-chip";

type Props = { params: { chain: string; address: string } };

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export default function WalletChainAddressPage({ params }: Props) {
  const wallet = smartMoneyWallets.find(
    (w) => w.chain === params.chain && w.address.toLowerCase() === params.address.toLowerCase(),
  );
  if (!wallet) notFound();

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h1 className="text-lg font-semibold text-slate-100">Wallet Detail</h1>
        <p className="mt-1 font-mono text-xs text-slate-400 break-all">{wallet.address}</p>
        <p className="mt-1 text-xs text-slate-500">{wallet.chain.toUpperCase()} · {wallet.walletType}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Score</p>
          <p className="text-lg font-semibold text-slate-100">{wallet.score}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">ROI 30D</p>
          <p className="text-lg font-semibold text-emerald-300">+{(wallet.roi30d * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">ROI 90D</p>
          <p className="text-lg font-semibold text-emerald-300">+{(wallet.roi90d * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Holdings</p>
          <p className="text-lg font-semibold text-slate-100">{formatUsd(wallet.holdingsUsd)}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Top Tokens</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {wallet.topTokens.map((symbol) => (
            <Link key={symbol} href={`/wallets/tokens/${symbol.toLowerCase()}`}>
              <TokenChip symbol={symbol} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

