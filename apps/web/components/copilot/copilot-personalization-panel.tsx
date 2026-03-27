"use client";

import Link from "next/link";
import { Bookmark, Layers, Link2, Wallet } from "lucide-react";
import type { CopilotPortfolioDto } from "@/lib/copilot-api";
import type { TokenWatchDto } from "@/lib/token-watch-api";

type Props = {
  portfolio: CopilotPortfolioDto | null;
  watches: TokenWatchDto[];
  watchesError?: string | null;
};

export function CopilotPersonalizationPanel({ portfolio, watches, watchesError }: Props) {
  const tokens = portfolio?.portfolio_tokens ?? [];
  const distinctWatches = Array.from(new Map(watches.map((w) => [w.token_symbol, w])).values());

  return (
    <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5 shadow-b70-card">
        <div className="flex items-center gap-2 text-xs font-medium text-crypto-blue">
          <Wallet className="h-3.5 w-3.5" aria-hidden />
          Your book
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--b70-text)]">Personalization</h2>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Portfolio exposure and symbols you track flow into Copilot scoring.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)]/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--b70-text)]">
              <Layers className="h-3.5 w-3.5 text-crypto-blue" aria-hidden />
              Portfolio
            </div>
            {tokens.length ? (
              <>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
                  {portfolio?.total_value_usd != null && portfolio.total_value_usd > 0
                    ? portfolio.total_value_usd >= 1e6
                      ? `$${(portfolio.total_value_usd / 1e6).toFixed(2)}M`
                      : portfolio.total_value_usd >= 1e3
                        ? `$${(portfolio.total_value_usd / 1e3).toFixed(1)}K`
                        : `$${portfolio.total_value_usd.toFixed(0)}`
                    : "—"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--b70-text-muted)]">
                  {tokens.length} token{tokens.length === 1 ? "" : "s"} linked
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tokens.slice(0, 8).map((t) => (
                    <Link
                      key={t}
                      href={`/radar/${encodeURIComponent(t)}`}
                      className="rounded-md bg-crypto-blue/15 px-2 py-0.5 text-xs font-medium text-crypto-blue hover:bg-crypto-blue/25"
                    >
                      {t}
                    </Link>
                  ))}
                  {tokens.length > 8 ? (
                    <span className="text-xs text-[var(--b70-text-muted)]">+{tokens.length - 8}</span>
                  ) : null}
                </div>
                {portfolio && portfolio.risk_concentrations.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-[var(--b70-border)]/60 pt-3 text-xs text-[var(--b70-text-muted)]">
                    {portfolio.risk_concentrations.slice(0, 3).map((r) => (
                      <li key={r.token_symbol}>
                        <span className="font-medium text-[var(--b70-text)]">{r.token_symbol}</span>{" "}
                        {r.allocation_pct.toFixed(1)}% · {r.risk_level} risk
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link
                  href="/account"
                  className="mt-3 inline-block text-xs font-medium text-crypto-blue hover:underline"
                >
                  Manage account & wallets
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--b70-text-muted)]">
                Add portfolio balances to unlock concentration and whale overlap in the desk.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)]/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--b70-text)]">
              <Bookmark className="h-3.5 w-3.5 text-crypto-blue" aria-hidden />
              Watchlist
            </div>
            <p className="mt-2 text-xs text-[var(--b70-text-muted)]">
              Server-side token watches (used by Copilot for signals and opportunities).
            </p>
            {watchesError ? (
              <p className="mt-2 text-xs text-rose-400">{watchesError}</p>
            ) : distinctWatches.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {distinctWatches.map((w) => (
                  <Link
                    key={w.id}
                    href={`/radar/${encodeURIComponent(w.token_symbol)}`}
                    className="rounded-md border border-[var(--b70-border)] bg-[var(--b70-card)] px-2 py-0.5 text-xs font-medium text-[var(--b70-text)] hover:border-crypto-blue/50"
                  >
                    {w.token_symbol}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--b70-text-muted)]">
                No token watches yet—save symbols from radar or signals to build this list.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
              <Link href="/watchlist" className="inline-flex items-center gap-1 text-crypto-blue hover:underline">
                <Link2 className="h-3 w-3" aria-hidden />
                Opportunity watchlist
              </Link>
            </div>
          </div>
        </div>
    </section>
  );
}
