import { CHAINS } from "@/lib/crypto-mock";

export const metadata = {
  title: "Chains · Block70 Crypto Data",
  description:
    "Mock chain metrics that will later power Block70's liquidity and narrative intelligence.",
};

export default function ChainsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Chains</h1>
        <p className="text-sm text-slate-400">
          High-level settlement layers Block70 cares about for opportunity
          sourcing.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {CHAINS.map((chain) => (
          <article
            key={chain.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
          >
            <h2 className="text-sm font-semibold text-slate-50">
              {chain.name}{" "}
              <span className="text-[11px] text-slate-400">
                {chain.symbol}
              </span>
            </h2>
            <p className="mt-2 text-[11px] text-slate-400">
              TVL:{" "}
              <span className="font-medium text-slate-100">
                $
                {Math.round(chain.tvlUsd / 1_000_000_000).toLocaleString()}B
              </span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Market cap (approx):{" "}
              <span className="font-medium text-slate-100">
                $
                {Math.round(
                  chain.marketCapUsd / 1_000_000_000,
                ).toLocaleString()}
                B
              </span>
            </p>
            <p className="mt-3 text-[11px] text-slate-500">
              Later we&apos;ll tie this to Block70&apos;s liquidity, miner, and
              wallet flows per chain.
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

