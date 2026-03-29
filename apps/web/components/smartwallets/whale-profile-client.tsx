"use client";

import { useEffect, useState } from "react";

import { RecentActionsFeed } from "@/components/smartwallets/recent-actions-feed";
import type { SmartMoneyWallet } from "@/data/smartMoneyWallets";
import type { NormalizedWalletActivity } from "@/services/blockchain/types";
import type { WalletActivityItem, WalletLedgerItem } from "@/lib/api";
import {
  addWhaleWatchEntry,
  isWhaleWatched,
  removeWhaleWatchEntry,
} from "@/lib/whale-watchlist";
import { clsx } from "clsx";

type Perf = {
  wallet_address: string;
  chain: string;
  roi: number;
  win_rate: number;
  token_holdings: { symbol: string; balance: number }[];
  holdings_status?: string;
  holdings_note?: string;
} | null;

type Tab = "performance" | "holdings" | "activity";

type Props = {
  chain: SmartMoneyWallet["chain"];
  address: string;
  seed: SmartMoneyWallet;
  live: NormalizedWalletActivity;
  performance: Perf;
  opportunityItems: WalletActivityItem[];
  ledgerItems: WalletLedgerItem[];
  activityDisclaimer?: string;
};

function formatCoin(chain: SmartMoneyWallet["chain"], v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  const decimals = chain === "bitcoin" ? 8 : chain === "solana" ? 4 : 6;
  return v.toFixed(decimals);
}

export function WhaleProfileClient({
  chain,
  address,
  seed,
  live,
  performance,
  opportunityItems,
  ledgerItems,
  activityDisclaimer,
}: Props) {
  const [tab, setTab] = useState<Tab>("performance");
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setFollowing(isWhaleWatched(chain, address));
  }, [chain, address]);

  const netflow =
    live.inflow24h != null && live.outflow24h != null ? live.inflow24h - live.outflow24h : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--b70-text)]">Wallet intelligence</h1>
          <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-xs text-[var(--b70-text-muted)] break-all">
            {address}
          </p>
          <p className="mt-1 text-xs uppercase text-[var(--b70-text-muted)]">
            {chain} · {seed.walletType}
            {seed.score > 0 ? ` · score ${seed.score}` : " · explorer"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (following) {
              removeWhaleWatchEntry(chain, address);
              setFollowing(false);
            } else {
              addWhaleWatchEntry({ chain, address });
              setFollowing(true);
            }
          }}
          className={clsx(
            "rounded-lg px-4 py-2 text-xs font-medium",
            following
              ? "border border-[var(--b70-border)] bg-[var(--b70-card)] text-[var(--b70-text)]"
              : "bg-[var(--b70-crypto-blue)] text-white",
          )}
        >
          {following ? "Following" : "Follow (watchlist)"}
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-3">
          <p className="text-[11px] text-[var(--b70-text-muted)]">Balance</p>
          <p className="text-lg font-semibold text-[var(--b70-text)]">
            {live.fetchError ? live.fetchError : formatCoin(chain, live.balance)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-3">
          <p className="text-[11px] text-[var(--b70-text-muted)]">Tx (24h)</p>
          <p className="text-lg font-semibold text-[var(--b70-text)]">
            {live.fetchError ? "—" : live.txCount ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-3">
          <p className="text-[11px] text-[var(--b70-text-muted)]">Netflow 24h</p>
          <p className="text-lg font-semibold text-[var(--b70-text)]">
            {live.fetchError || netflow == null
              ? "—"
              : `${netflow >= 0 ? "+" : ""}${formatCoin(chain, netflow)}`}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-3">
          <p className="text-[11px] text-[var(--b70-text-muted)]">Last activity</p>
          <p className="text-lg font-semibold text-[var(--b70-text)]">
            {live.lastActivity ? new Date(live.lastActivity).toLocaleString() : "—"}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-[var(--b70-border)] pb-2">
        {(["performance", "holdings", "activity"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs font-medium capitalize",
              tab === t
                ? "bg-[var(--b70-crypto-blue)] text-white"
                : "text-[var(--b70-text-muted)] hover:bg-[var(--b70-card)]",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "performance" && (
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/40 p-4">
          {!performance ? (
            <p className="text-sm text-[var(--b70-text-muted)]">
              No performance record in Block70 for this address yet. RPC overview above still reflects live
              chain stats when available.
            </p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] text-[var(--b70-text-muted)]">ROI (model)</dt>
                <dd className="text-lg font-semibold text-emerald-400/90">
                  {(performance.roi * 100).toFixed(1)}%
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[var(--b70-text-muted)]">Win rate</dt>
                <dd className="text-lg font-semibold text-[var(--b70-text)]">
                  {(performance.win_rate * 100).toFixed(1)}%
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-[var(--b70-text-muted)]">Chain (profile)</dt>
                <dd className="text-lg font-semibold text-[var(--b70-text)]">{performance.chain}</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {tab === "holdings" && (
        <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/40 p-4">
          {!performance?.token_holdings?.length ? (
            <div className="text-sm text-[var(--b70-text-muted)]">
              <p>
                {performance?.holdings_note ??
                  "Holdings will appear when token balances are enriched from indexers or RPC."}
              </p>
              <p className="mt-2 text-[11px] uppercase text-[var(--b70-text-muted)]">
                Status: {performance?.holdings_status ?? "unavailable"}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {performance.token_holdings.map((h) => (
                <li
                  key={h.symbol}
                  className="flex justify-between text-sm text-[var(--b70-text)]"
                >
                  <span>{h.symbol}</span>
                  <span className="font-[family-name:var(--font-jetbrains)]">{h.balance}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "activity" && (
        <RecentActionsFeed
          opportunityItems={opportunityItems}
          ledgerItems={ledgerItems}
          opportunityDisclaimer={activityDisclaimer}
        />
      )}
    </div>
  );
}
