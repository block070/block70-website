"use client";

import type { ChainDto } from "@/lib/api";
import { chainsCompareSlug } from "@/lib/chains-compare-slug";
import { formatChangePct, formatCompactUsd } from "@/lib/format";
import { clsx } from "clsx";
import { Rocket } from "lucide-react";

const STRIP_LIMIT = 8;

type Props = { chains: ChainDto[] };

export function ChainsFastGrowingStrip({ chains }: Props) {
  const ranked = [...chains]
    .sort((a, b) => b.tvl_24h_change - a.tvl_24h_change)
    .slice(0, STRIP_LIMIT);

  if (ranked.length === 0) return null;

  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Rocket className="h-4 w-4 text-amber-400" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--b70-text)]">Fastest-growing TVL (24h %)</h2>
      </div>
      <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
        Ranked by reported or modeled 24h change. When DeFiLlama omits change, we use a deterministic
        placeholder — hover a badge for &quot;estimated&quot;.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ranked.map((c) => {
          const slug = chainsCompareSlug(c.name);
          const est = c.tvl_change_is_estimated === true;
          return (
            <div
              key={slug}
              className="inline-flex min-w-[140px] flex-1 flex-col rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)]/50 px-3 py-2"
            >
              <span className="text-xs font-medium text-[var(--b70-text)]">{c.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={clsx(
                    "text-sm font-semibold tabular-nums",
                    c.tvl_24h_change >= 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {formatChangePct(c.tvl_24h_change)}
                </span>
                {est && (
                  <span
                    className="rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-200"
                    title="24h % is a placeholder when the API does not return chain-level change."
                  >
                    Est.
                  </span>
                )}
              </span>
              <span className="text-[10px] text-[var(--b70-text-muted)]">
                TVL {formatCompactUsd(c.tvl)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
