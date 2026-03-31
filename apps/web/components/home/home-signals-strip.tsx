"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { SignalDto } from "@/lib/types";

type Props = {
  signals: SignalDto[];
};

export function HomeSignalsStrip({ signals }: Props) {
  const prevRef = useRef<Map<number, number>>(new Map());
  const [spikeIds, setSpikeIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const next = new Set<number>();
    const map = prevRef.current;
    for (const s of signals) {
      const conf =
        typeof s.confidence_score === "number" ? s.confidence_score : 0;
      const prev = map.get(s.id);
      if (prev !== undefined && conf > prev + 3) next.add(s.id);
      map.set(s.id, conf);
    }
    setSpikeIds(next);
  }, [signals]);

  const row = signals.slice(0, 6);
  if (!row.length) return null;

  return (
    <section
      aria-label="Live signals"
      className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card-elevated)] px-2 py-2 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Signal alert strip
        </p>
        <Link
          href="/signals"
          className="shrink-0 text-[10px] font-semibold text-[var(--b70-crypto-blue)] hover:underline"
        >
          All signals →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 pb-1 sm:grid-cols-3 lg:grid-cols-6">
        {row.map((s) => (
          <Link
            key={s.id}
            href={
              s.token_symbol
                ? `/signals/${encodeURIComponent(s.token_symbol)}`
                : "/signals"
            }
            className={clsx(
              "min-w-0 rounded-lg border px-3 py-2 transition-all duration-200",
              "border-[var(--b70-border)] bg-[var(--b70-card)] hover:-translate-y-0.5 hover:border-[var(--b70-crypto-blue)]/40 hover:shadow-md",
              spikeIds.has(s.id) && "b70-signal-spike border-amber-500/40 ring-1 ring-amber-500/25",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
                {s.signal_type}
              </span>
              {spikeIds.has(s.id) ? (
                <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                  Spike
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate font-[family-name:var(--font-jetbrains)] text-xs text-[var(--b70-text)]">
              {s.token_symbol || s.title || "Signal"}
            </p>
            <p className="mt-0.5 font-[family-name:var(--font-jetbrains)] text-[10px] text-[var(--b70-crypto-blue)]">
              {Number(s.confidence_score).toFixed(0)}% conf
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
