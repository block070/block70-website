"use client";

import type { ChainDto } from "@/lib/api";
import { chainsCompareSlug } from "@/lib/chains-compare-slug";
import { formatChangePct, formatCompactUsd, formatNetflow } from "@/lib/format";
import { X } from "lucide-react";

type Props = {
  chains: ChainDto[];
  compareSlugs: string[];
  onRemove: (slug: string) => void;
  onClear: () => void;
};

export function ChainsCompareBar({ chains, compareSlugs, onRemove, onClear }: Props) {
  if (compareSlugs.length === 0) return null;

  const rows = compareSlugs
    .map((slug) => chains.find((c) => chainsCompareSlug(c.name) === slug))
    .filter((c): c is ChainDto => c != null);

  if (rows.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-crypto-blue/30 bg-[var(--b70-card)]/95 p-4 shadow-lg backdrop-blur-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--b70-text)]">Compare ecosystems</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] font-medium text-crypto-blue hover:underline"
        >
          Clear all
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-[var(--b70-border)] text-[var(--b70-text-muted)]">
              <th className="py-2 pr-4 font-medium">Chain</th>
              <th className="py-2 pr-4 text-right font-medium">TVL</th>
              <th className="py-2 pr-4 text-right font-medium">24h %</th>
              <th className="py-2 pr-4 text-right font-medium">Netflow 24h</th>
              <th className="py-2 pr-4 text-right font-medium">Vol 24h</th>
              <th className="py-2 pr-4 text-right font-medium">Fees 24h</th>
              <th className="py-2 pr-4 text-right font-medium">DAAs</th>
              <th className="py-2" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--b70-border)]">
            {rows.map((c) => {
              const slug = chainsCompareSlug(c.name);
              const v = c.volume_24h;
              const f = c.fees_24h;
              const w = c.active_addresses_24h ?? c.active_users;
              return (
                <tr key={slug}>
                  <td className="py-2 pr-4 font-medium text-[var(--b70-text)]">
                    {c.name}
                    <span className="ml-1 text-[var(--b70-text-muted)]">{c.symbol}</span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--b70-text)]">
                    {formatCompactUsd(c.tvl)}
                  </td>
                  <td
                    className={
                      c.tvl_24h_change >= 0 ? "py-2 pr-4 text-right text-emerald-400" : "py-2 pr-4 text-right text-rose-400"
                    }
                  >
                    {formatChangePct(c.tvl_24h_change)}
                  </td>
                  <td
                    className={
                      c.netflow_24h >= 0 ? "py-2 pr-4 text-right text-emerald-400" : "py-2 pr-4 text-right text-rose-400"
                    }
                  >
                    {formatNetflow(c.netflow_24h)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--b70-text-muted)]">
                    {v != null && Number.isFinite(v) ? formatCompactUsd(v) : "—"}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--b70-text-muted)]">
                    {f != null && Number.isFinite(f) ? formatCompactUsd(f) : "—"}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--b70-text-muted)]">
                    {w != null && Number.isFinite(w) ? w.toLocaleString() : "—"}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onRemove(slug)}
                      className="rounded p-1 text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] hover:text-[var(--b70-text)]"
                      aria-label={`Remove ${c.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
