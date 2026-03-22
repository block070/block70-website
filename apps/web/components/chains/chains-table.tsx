"use client";

import React, { memo, useMemo, useState } from "react";
import type { ChainDto } from "@/lib/api";
import {
  formatCompactUsd,
  formatChangePct,
  formatNetflow,
} from "@/lib/format";
import { ChainSparkline } from "./chain-sparkline";
import { ChainRowExpanded } from "./chain-row-expanded";
import { ChevronDown, ChevronRight } from "lucide-react";

export type SortKey = "netflow" | "tvl" | "momentum" | "tvl_change" | "declining";

type Props = {
  chains: ChainDto[];
  sortBy: SortKey;
  onSortChange: (key: SortKey) => void;
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
    copy.sort((a, b) => a.tvl_24h_change - b.tvl_24h_change); // most negative first
  }
  return copy;
}

function getBadges(chain: ChainDto, rank: number): string[] {
  const badges: string[] = [];
  if (rank < 5) badges.push("🔥 Hot");
  if (chain.tvl_24h_change > 5) badges.push("🚀 Growing");
  if (chain.tvl_24h_change < -5) badges.push("⚠️ Declining");
  return badges;
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
      className="cursor-pointer select-none px-3 py-2 text-right font-medium text-slate-400 hover:text-slate-300"
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
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => sortChains(chains, sortBy), [chains, sortBy]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-900/80 text-slate-400">
          <tr>
            <th className="w-8 px-2 py-2"></th>
            <th className="px-3 py-2 font-medium">Chain Name</th>
            <th className="px-3 py-2 font-medium text-right">TVL</th>
            <th className="px-3 py-2 font-medium text-right">24h %</th>
            <SortHeader
              label="Netflow (24h)"
              active={sortBy === "netflow"}
              ascending={true}
              onClick={() => onSortChange("netflow")}
            />
            <th className="px-3 py-2 text-center font-medium">7D Activity</th>
            <SortHeader
              label="Momentum"
              active={sortBy === "momentum"}
              onClick={() => onSortChange("momentum")}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((chain, i) => {
            const key = `${chain.name}-${chain.symbol}`;
            const isExpanded = expanded.has(key);
            const badges = getBadges(chain, i + 1);

            return (
              <React.Fragment key={key}>
                <tr
                  key={key}
                  className="cursor-pointer transition hover:bg-slate-900/60"
                  onClick={() => toggleExpand(key)}
                >
                  <td className="px-2 py-2 text-slate-500">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-slate-50">
                        {chain.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {chain.symbol}
                      </span>
                      {badges.map((b) => (
                        <span
                          key={b}
                          className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-200">
                    {formatCompactUsd(chain.tvl)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${
                      chain.tvl_24h_change >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatChangePct(chain.tvl_24h_change)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${
                      chain.netflow_24h >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {formatNetflow(chain.netflow_24h)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center">
                      <ChainSparkline chainName={chain.name} tvl={chain.tvl} />
                    </div>
                  </td>
                  <td
                    className={`px-3 py-2 text-right ${
                      chain.momentum_score >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {chain.momentum_score.toFixed(2)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <ChainRowExpanded chainName={chain.name} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
