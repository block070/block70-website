"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  getWhaleWatchlist,
  removeWhaleWatchEntry,
  type WhaleWatchEntry,
} from "@/lib/whale-watchlist";

export function CopyTradeWatchlistPanel() {
  const [items, setItems] = useState<WhaleWatchEntry[]>([]);

  const refresh = useCallback(() => {
    setItems(getWhaleWatchlist());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-100/90">
        <p className="font-medium text-amber-50">Copy-trade mode is informational only</p>
        <p className="mt-1 text-amber-200/80">
          Following a wallet does not execute trades. Use this list to monitor smart money and do your own
          research—not financial advice.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-card)]/50 p-6 text-sm text-[var(--b70-text-muted)]">
          No wallets followed yet. Open a{" "}
          <Link href="/smartwallets" className="text-[var(--b70-crypto-blue)] hover:underline">
            profile
          </Link>{" "}
          and choose <strong>Follow</strong>.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li
              key={`${e.chain}-${e.address}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 px-3 py-2 text-xs"
            >
              <div>
                <Link
                  href={`/smartwallets/${e.chain}/${encodeURIComponent(e.address)}`}
                  className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-crypto-blue)] hover:underline"
                >
                  {e.address.slice(0, 12)}…{e.address.slice(-6)}
                </Link>
                <span className="ml-2 uppercase text-[var(--b70-text-muted)]">{e.chain}</span>
                {e.note ? (
                  <p className="mt-1 text-[var(--b70-text-muted)]">{e.note}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  removeWhaleWatchEntry(e.chain, e.address);
                  refresh();
                }}
                className="shrink-0 rounded-md border border-[var(--b70-border)] px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10"
              >
                Unfollow
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
