"use client";

import React, { memo, useMemo, useState } from "react";
import type { ChainDto } from "@/lib/api";
import {
  formatCompactUsd,
  formatChangePct,
  formatNetflow,
} from "@/lib/format";
import { chainsCompareSlug } from "@/lib/chains-compare-slug";
import { ChainSparkline } from "./chain-sparkline";
import { ChainRowExpanded } from "./chain-row-expanded";
import { MomentumCell } from "./momentum-cell";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Flame,
  Rocket,
} from "lucide-react";
import { clsx } from "clsx";

function whyItIsMoving(chain: ChainDto): string {
  if (chain.netflow_24h > 0) {
    if (chain.tvl_24h_change > 5) return "Capital inflow increasing sharply";
    return "Capital inflow increasing";
  }
  if (chain.netflow_24h < 0) return "Capital rotating out";
  if (chain.tvl_24h_change > 3) return "Flow stabilizing / slower adds";
  if (chain.tvl_24h_change < -3) return "Profit-taking pressure";
  return "Stable flows";
}

export type SortKey = "netflow" | "tvl" | "momentum" | "tvl_change" | "declining";

type Props = {
  chains: ChainDto[];
  sortBy: SortKey;
  onSortChange: (key: SortKey) => void;
  compareSlugs: string[];
  onCompareToggle: (slug: string) => void;
  maxCompare?: number;
};

function sortChains(chains: ChainDto[], key: SortKey): ChainDto[] {
  const copy = [...chains];
  if (key === "netflow") {
    copy.sort((a, b) => b.netflow_24h - a.netflow_24h);
  } else if (key === "tvl") {
    copy.sort((a, b) => b.tvl - a.tvl);
  } else if (key === "momentum") {
    copy.sort((a, b) => b.momentum_score - a.momentum_score);
  } else if (key === "tvl_change") {
    copy.sort((a, b) => b.tvl_24h_change - a.tvl_24h_change);
  } else if (key === "declining") {
    copy.sort((a, b) => a.tvl_24h_change - b.tvl_24h_change);
  }
  return copy;
}

function ChainBadgeIcons({ chain, rank }: { chain: ChainDto; rank: number }) {
  const nodes: React.ReactNode[] = [];
  if (rank < 5) {
    nodes.push(
      <span
        key="hot"
        className="inline-flex items-center gap-0.5 rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200"
        title="Top inflow cohort"
      >
        <Flame className="h-3 w-3" aria-hidden />
        Hot
      </span>,
    );
  }
  if (chain.tvl_24h_change > 5) {
    nodes.push(
      <span
        key="grow"
        className="inline-flex items-center gap-0.5 rounded border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300"
        title="High modeled 24h TVL growth"
      >
        <Rocket className="h-3 w-3" aria-hidden />
        Growing
      </span>,
    );
  }
  if (chain.tvl_24h_change < -5) {
    nodes.push(
      <span
        key="down"
        className="inline-flex items-center gap-0.5 rounded border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-300"
        title="Sharp modeled 24h TVL drawdown"
      >
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Weak
      </span>,
    );
  }
  if (nodes.length === 0) return null;
  return <span className="flex flex-wrap items-center gap-1">{nodes}</span>;
}

const SortHeader = memo(function SortHeader({
  label,
  active,
  ascending,
  onClick,
}: {
  label: string;
  active: boolean;
  ascending?: boolean;
  onClick: () => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-2 py-2 text-right font-medium text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
      onClick={onClick}
    >
      {label}
      {active && (
        <span className="ml-1 text-[10px]">
          {ascending === false ? "↓" : "↑"}
        </span>
      )}
    </th>
  );
});

export const ChainsTable = memo(function ChainsTable({
  chains,
  sortBy,
  onSortChange,
  compareSlugs,
  onCompareToggle,
  maxCompare = 4,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => sortChains(chains, sortBy), [chains, sortBy]);

  const momentumRange = useMemo(() => {
    if (sorted.length === 0) return { min: 0, max: 100 };
    const scores = sorted.map((c) => c.momentum_score);
    return { min: Math.min(...scores), max: Math.max(...scores) };
  }, [sorted]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fmtVolFee = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? formatCompactUsd(n) : "—";

  const fmtWallets = (c: ChainDto) => {
    const w = c.active_addresses_24h ?? c.active_users;
    if (w != null && Number.isFinite(w)) return w.toLocaleString();
    return "—";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/80">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[var(--b70-bg)]/60 text-[var(--b70-text-muted)]">
          <tr>
            <th className="w-8 px-1 py-2"></th>
            <th
              className="w-8 px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wide"
              title="Add to compare"
            >
              Cmp
            </th>
            <th className="px-2 py-2 font-medium">Chain</th>
            <th className="px-2 py-2 text-right font-medium">TVL</th>
            <th className="px-2 py-2 text-right font-medium">24h %</th>
            <th className="px-2 py-2 text-right font-medium" title="When connectors exist">
              Vol 24h
            </th>
            <th className="px-2 py-2 text-right font-medium" title="When connectors exist">
              Fees 24h
            </th>
            <th className="px-2 py-2 text-right font-medium" title="Daily active addresses">
              Wallets
            </th>
            <SortHeader
              label="Netflow"
              active={sortBy === "netflow"}
              ascending={true}
              onClick={() => onSortChange("netflow")}
            />
            <th className="px-2 py-2 font-medium">Flow narrative</th>
            <th className="px-2 py-2 text-center font-medium">Activity</th>
            <SortHeader
              label="Momentum"
              active={sortBy === "momentum"}
              onClick={() => onSortChange("momentum")}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--b70-border)]">
          {sorted.map((chain, i) => {
            const key = `${chain.name}-${chain.symbol}`;
            const isExpanded = expanded.has(key);
            const slug = chainsCompareSlug(chain.name);
            const inCompare = compareSlugs.includes(slug);
            const atCap = compareSlugs.length >= maxCompare && !inCompare;
            const est = chain.tvl_change_is_estimated === true;

            return (
              <React.Fragment key={key}>
                <tr
                  className="cursor-pointer transition hover:bg-[var(--b70-bg)]/50"
                  onClick={() => toggleExpand(key)}
                >
                  <td className="px-1 py-2 text-[var(--b70-text-muted)]">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </td>
                  <td
                    className="px-1 py-2 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={inCompare}
                      disabled={atCap}
                      title={
                        atCap
                          ? `Select up to ${maxCompare} chains`
                          : "Add to compare bar"
                      }
                      aria-label={`Compare ${chain.name}`}
                      className="h-3.5 w-3.5 rounded border-[var(--b70-border)]"
                      onChange={() => onCompareToggle(slug)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-[var(--b70-text)]">
                        {chain.name}{" "}
                        <span className="text-[11px] font-normal text-[var(--b70-text-muted)]">
                          {chain.symbol}
                        </span>
                      </span>
                      <ChainBadgeIcons chain={chain} rank={i + 1} />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--b70-text)]">
                    {formatCompactUsd(chain.tvl)}
                  </td>
                  <td
                    className={clsx(
                      "px-2 py-2 text-right tabular-nums",
                      chain.tvl_24h_change >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                    title={
                      est
                        ? "24h % modeled — DeFiLlama chain list often omits native change."
                        : undefined
                    }
                  >
                    {formatChangePct(chain.tvl_24h_change)}
                    {est && (
                      <span className="ml-1 align-super text-[8px] font-semibold text-amber-300">
                        *
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--b70-text-muted)]">
                    {fmtVolFee(chain.volume_24h)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--b70-text-muted)]">
                    {fmtVolFee(chain.fees_24h)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--b70-text-muted)]">
                    {fmtWallets(chain)}
                  </td>
                  <td
                    className={clsx(
                      "px-2 py-2 text-right tabular-nums",
                      chain.netflow_24h >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {formatNetflow(chain.netflow_24h)}
                  </td>
                  <td className="max-w-[130px] px-2 py-2 text-[var(--b70-text-muted)]">
                    {whyItIsMoving(chain)}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-center">
                      <ChainSparkline chainName={chain.name} tvl={chain.tvl} />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <MomentumCell
                      score={chain.momentum_score}
                      minScore={momentumRange.min}
                      maxScore={momentumRange.max}
                    />
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={12} className="p-0">
                      <ChainRowExpanded chainName={chain.name} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-[var(--b70-border)] px-3 py-2 text-[10px] text-[var(--b70-text-muted)]">
        * 24h TVL % is estimated when the upstream API does not report chain-level daily change. Netflow
        is derived from TVL × 24h % and is a liquidity model, not bridge receipts.
      </p>
    </div>
  );
});
