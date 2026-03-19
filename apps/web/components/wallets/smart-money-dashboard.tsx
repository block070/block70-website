"use client";

import { useMemo, useState } from "react";
import type { SmartAlert } from "@/data/alerts";
import type { SmartMoneyWallet } from "@/data/smartMoneyWallets";
import type { SmartToken } from "@/data/tokens";
import { AlertCard } from "./alert-card";
import { FilterBar } from "./filter-bar";
import { TokenChip } from "./token-chip";
import { WalletTable } from "./wallet-table";

type SortKey = "score" | "roi" | "activity";
type Tab = "BTC" | "ETH" | "SOL";

type Props = {
  wallets: SmartMoneyWallet[];
  alerts: SmartAlert[];
  tokens: SmartToken[];
};

export function SmartMoneyDashboard({ wallets, alerts, tokens }: Props) {
  const [chain, setChain] = useState("all");
  const [walletType, setWalletType] = useState("all");
  const [minScore, setMinScore] = useState(70);
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [tab, setTab] = useState<Tab>("BTC");

  const filtered = useMemo(() => {
    const chainForTab = tab === "BTC" ? "bitcoin" : tab === "ETH" ? "ethereum" : "solana";
    return wallets
      .filter((w) => (chain === "all" ? true : w.chain === chain))
      .filter((w) => (walletType === "all" ? true : w.walletType === walletType))
      .filter((w) => w.score >= minScore)
      .filter((w) => w.chain === chainForTab)
      .sort((a, b) => {
        if (sortBy === "roi") return b.roi30d - a.roi30d;
        if (sortBy === "activity") return b.activityCount7d - a.activityCount7d;
        return b.score - a.score;
      });
  }, [wallets, chain, walletType, minScore, sortBy, tab]);

  const topTokens = tokens
    .slice()
    .sort((a, b) => b.netflowUsd24h - a.netflowUsd24h)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1">
          {(["BTC", "ETH", "SOL"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-xs font-medium ${tab === t ? "bg-emerald-600/20 text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1 text-xs">
          {([
            ["score", "Sort: Score"],
            ["roi", "Sort: ROI"],
            ["activity", "Sort: Activity"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={`rounded px-3 py-1 ${sortBy === key ? "bg-slate-700 text-slate-100" : "text-slate-400"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <FilterBar
        chain={chain}
        walletType={walletType}
        minScore={minScore}
        onChainChange={setChain}
        onWalletTypeChange={setWalletType}
        onMinScoreChange={setMinScore}
      />

      <WalletTable wallets={filtered} />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-100">Alerts Panel</h3>
          <div className="mt-3 space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-100">Trending Tokens</h3>
          <ul className="mt-3 space-y-2">
            {topTokens.map((token) => (
              <li key={token.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <p className="text-xs font-medium text-slate-100">{token.name}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Netflow 24H: ${(token.netflowUsd24h / 1_000_000).toFixed(2)}M
                </p>
                <div className="mt-2">
                  <TokenChip symbol={token.symbol} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold text-slate-100">Top Gainers (Smart Wallets)</h3>
          <ul className="mt-3 space-y-2 text-xs">
            {filtered.slice(0, 5).map((wallet) => (
              <li key={wallet.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                <span className="font-mono text-slate-300">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                <span className="text-emerald-300">+{(wallet.roi30d * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

