import { notFound } from "next/navigation";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";
import { getLiveWallet } from "@/lib/smart-money-live";

type Props = { params: { chain: string; address: string } };

function formatCoin(chain: "bitcoin" | "ethereum" | "solana", v: number | null): string {
  if (v == null || Number.isNaN(v)) return "--";
  const decimals = chain === "bitcoin" ? 8 : chain === "solana" ? 4 : 6;
  return v.toFixed(decimals);
}

export default async function WalletChainAddressPage({ params }: Props) {
  const seed = smartMoneyWallets.find(
    (w) =>
      w.chain === (params.chain as any) &&
      w.address.toLowerCase() === params.address.toLowerCase(),
  );
  if (!seed) notFound();

  const live = await getLiveWallet(seed.chain, seed.address);

  const netflow =
    live.inflow24h != null && live.outflow24h != null ? live.inflow24h - live.outflow24h : null;
  const netflowStr =
    netflow == null ? "--" : `${netflow >= 0 ? "+" : ""}${formatCoin(seed.chain, netflow)}`;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h1 className="text-lg font-semibold text-slate-100">Wallet Detail</h1>
        <p className="mt-1 font-mono text-xs text-slate-400 break-all">{seed.address}</p>
        <p className="mt-1 text-xs text-slate-500">
          {seed.chain.toUpperCase()} · {seed.walletType}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Score</p>
          <p className="text-lg font-semibold text-slate-100">{seed.score}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Balance</p>
          <p className="text-lg font-semibold text-slate-100">
            {formatCoin(seed.chain, live.balance)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Tx Count (24h)</p>
          <p className="text-lg font-semibold text-slate-100">
            {live.txCount == null ? "--" : live.txCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Netflow (24h)</p>
          <p className="text-lg font-semibold text-slate-100">{netflowStr}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Last Activity</h2>
        <p className="mt-2 text-xs text-slate-400">
          {live.lastActivity ? new Date(live.lastActivity).toLocaleString() : "--"}
        </p>
        <div className="mt-3 text-xs text-slate-400">
          <span className="font-medium text-slate-200">Inflow 24h:</span>{" "}
          {formatCoin(seed.chain, live.inflow24h)}
          <br />
          <span className="font-medium text-slate-200">Outflow 24h:</span>{" "}
          {formatCoin(seed.chain, live.outflow24h)}
        </div>
      </section>
    </div>
  );
}

