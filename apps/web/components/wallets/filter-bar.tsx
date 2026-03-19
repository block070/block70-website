"use client";

type FilterBarProps = {
  chain: string;
  walletType: string;
  minScore: number;
  onChainChange: (value: string) => void;
  onWalletTypeChange: (value: string) => void;
  onMinScoreChange: (value: number) => void;
};

export function FilterBar({
  chain,
  walletType,
  minScore,
  onChainChange,
  onWalletTypeChange,
  onMinScoreChange,
}: FilterBarProps) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:grid-cols-3">
      <label className="text-xs text-slate-400">
        Chain
        <select
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
          value={chain}
          onChange={(e) => onChainChange(e.target.value)}
        >
          <option value="all">All</option>
          <option value="bitcoin">BTC</option>
          <option value="ethereum">ETH</option>
          <option value="solana">SOL</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Wallet Type
        <select
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
          value={walletType}
          onChange={(e) => onWalletTypeChange(e.target.value)}
        >
          <option value="all">All</option>
          <option value="fund">Fund</option>
          <option value="whale">Whale</option>
          <option value="market-maker">Market-Maker</option>
          <option value="dao-treasury">DAO Treasury</option>
        </select>
      </label>
      <label className="text-xs text-slate-400">
        Min Score
        <input
          type="range"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => onMinScoreChange(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <span className="text-[11px] text-slate-500">{minScore}</span>
      </label>
    </div>
  );
}

