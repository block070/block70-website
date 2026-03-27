"use client";

import type { ChainDto } from "@/lib/api";
import { chainsCompareSlug } from "@/lib/chains-compare-slug";
import { formatChangePct, formatCompactUsd, formatNetflow } from "@/lib/format";
import { clsx } from "clsx";
import { Activity, Layers } from "lucide-react";

type Props = {
  chains: ChainDto[];
  /** If set, highlights cards for slugs in the compare set. */
  compareSlugs: string[];
  max?: number;
};

export function ChainsHighlightCards({ chains, compareSlugs, max = 6 }: Props) {
  const top = [...chains].sort((a, b) => b.tvl - a.tvl).slice(0, max);

  if (top.length === 0) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {top.map((c) => {
        const slug = chainsCompareSlug(c.name);
        const inCompare = compareSlugs.includes(slug);
        const v = c.volume_24h;
        const fees = c.fees_24h;
        const daa = c.active_addresses_24h ?? c.active_users;
        const est = c.tvl_change_is_estimated === true;

        return (
          <article
            key={slug}
            className={clsx(
              "rounded-xl border p-4 transition",
              inCompare
                ? "border-crypto-blue/50 bg-crypto-blue/5 shadow-md"
                : "border-[var(--b70-border)] bg-[var(--b70-card)] shadow-sm",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--b70-text)]">{c.name}</h3>
                <p className="text-[11px] text-[var(--b70-text-muted)]">{c.symbol}</p>
              </div>
              {inCompare && (
                <span className="shrink-0 rounded border border-crypto-blue/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-crypto-blue">
                  Compare
                </span>
              )}
            </div>

            <dl className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-1 text-[var(--b70-text-muted)]">
                  <Layers className="h-3 w-3 opacity-70" aria-hidden />
                  TVL
                </dt>
                <dd className="font-medium tabular-nums text-[var(--b70-text)]">{formatCompactUsd(c.tvl)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--b70-text-muted)]">24h change</dt>
                <dd className="flex items-center gap-1">
                  <span
                    className={clsx(
                      "font-semibold tabular-nums",
                      c.tvl_24h_change >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {formatChangePct(c.tvl_24h_change)}
                  </span>
                  {est && (
                    <span
                      className="text-[9px] text-amber-200/90"
                      title="Modeled when API omits chain-level 24h change."
                    >
                      (est.)
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--b70-text-muted)]">24h flow</dt>
                <dd
                  className={clsx(
                    "font-medium tabular-nums",
                    c.netflow_24h >= 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {formatNetflow(c.netflow_24h)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="flex items-center gap-1 text-[var(--b70-text-muted)]">
                  <Activity className="h-3 w-3 opacity-70" aria-hidden />
                  Volume 24h
                </dt>
                <dd className="tabular-nums text-[var(--b70-text)]">
                  {v != null && Number.isFinite(v) ? formatCompactUsd(v) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--b70-text-muted)]">Fees 24h</dt>
                <dd className="tabular-nums text-[var(--b70-text)]">
                  {fees != null && Number.isFinite(fees) ? formatCompactUsd(fees) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--b70-text-muted)]">Active wallets</dt>
                <dd className="tabular-nums text-[var(--b70-text)]">
                  {daa != null && Number.isFinite(daa) ? daa.toLocaleString() : "Coming soon"}
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}
