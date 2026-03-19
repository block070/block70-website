import { notFound } from "next/navigation";
import { smartTokens } from "@/data/tokens";

type Props = { params: { tokenId: string } };

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export default function WalletTokenIntelligencePage({ params }: Props) {
  const token = smartTokens.find(
    (t) => t.id.toLowerCase() === params.tokenId.toLowerCase() || t.symbol.toLowerCase() === params.tokenId.toLowerCase(),
  );
  if (!token) notFound();

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h1 className="text-lg font-semibold text-slate-100">{token.name} Smart Money Intelligence</h1>
        <p className="mt-1 text-xs text-slate-400">
          {token.symbol} · {token.chain.toUpperCase()}
        </p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Accumulating Wallets</p>
          <p className="text-lg font-semibold text-emerald-300">{token.smartWalletsAccumulating}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Exiting Wallets</p>
          <p className="text-lg font-semibold text-rose-300">{token.smartWalletsExiting}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Netflow 24H</p>
          <p className="text-lg font-semibold text-slate-100">{formatUsd(token.netflowUsd24h)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-[11px] text-slate-500">Avg Exposure Score</p>
          <p className="text-lg font-semibold text-slate-100">{token.avgScoreExposure}</p>
        </div>
      </section>
    </div>
  );
}

