"use client";

import Link from "next/link";
import { ExternalLink, LineChart } from "lucide-react";
import { clsx } from "clsx";
import type { AlphaEvent, AlphaRankedOpportunity } from "@/lib/types";
import {
  confidencePercent,
  engineBriefImpactLine,
  engineWhyLine,
} from "@/lib/alpha-desk-present";

function eventTypeLabel(eventType: string): string {
  switch (eventType) {
    case "arbitrage_detected":
      return "Arbitrage";
    case "whale_buy":
      return "Whale flow";
    case "miner_roi_spike":
      return "Yield / miner";
    case "trend_signal":
      return "Trend";
    default:
      return eventType.replace(/_/g, " ");
  }
}

type RankedProps = {
  variant: "ranked";
  entry: AlphaRankedOpportunity;
  premiumLocked: boolean;
};

type EventProps = {
  variant: "event";
  entry: AlphaEvent;
};

type Props = RankedProps | EventProps;

export function AlphaEngineBriefCard(props: Props) {
  if (props.variant === "event") {
    const ev = props.entry;
    const sym = ev.token_symbol ?? "—";
    const conf = confidencePercent(ev.confidence_score);
    const href = ev.token_symbol
      ? `/radar/${encodeURIComponent(ev.token_symbol)}`
      : "/radar";

    return (
      <article
        className={clsx(
          "rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm",
          "hover:border-[var(--b70-crypto-blue)]/35",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--b70-text)]">
            {eventTypeLabel(ev.event_type)}
          </span>
          <span className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-[var(--b70-text)]">
            {sym}
          </span>
          <span className="text-[10px] text-[var(--b70-text-muted)]">Conf {conf}%</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--b70-text-muted)]">{ev.summary}</p>
        <Link
          href={href}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--b70-crypto-blue)] hover:underline"
        >
          Open radar
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </article>
    );
  }

  const { entry, premiumLocked } = props;
  const opp = entry.opportunity;
  const sym = opp.asset_symbol ?? opp.base_symbol ?? "—";
  const conf = confidencePercent(opp.confidence_score);
  const deskRank = Math.round(Math.max(0, Math.min(1, entry.alpha_score)) * 100);
  const why = engineWhyLine(opp);
  const impact = engineBriefImpactLine(opp);

  return (
    <article
      className={clsx(
        "rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm",
        "hover:border-[var(--b70-crypto-blue)]/35",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--b70-crypto-blue)]/30 bg-[var(--b70-crypto-blue)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--b70-crypto-blue)]">
          <LineChart className="h-3 w-3" aria-hidden />
          Desk rank {deskRank}%
        </span>
        <span className="font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-[var(--b70-text)]">
          {sym}
        </span>
        <span className="rounded-md border border-[var(--b70-border)] px-2 py-0.5 text-[10px] capitalize text-[var(--b70-text-muted)]">
          {opp.type.replace(/_/g, " ")}
        </span>
        <span className="text-[10px] text-[var(--b70-text-muted)]">Model conf {conf}%</span>
      </div>
      <h3 className="mt-2 text-sm font-medium text-[var(--b70-text)]">{opp.title}</h3>
      {premiumLocked ? (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3">
          <p className="text-[11px] text-[var(--b70-text-muted)]">
            Full desk brief available on Pro/Elite.
          </p>
          <div className="pointer-events-none max-h-20 select-none blur-sm">
            <p className="text-xs">{why}</p>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-[var(--b70-card)] to-transparent pb-2">
            <Link
              href="/pricing"
              className="pointer-events-auto rounded-lg bg-[var(--b70-crypto-blue)] px-3 py-1 text-[10px] font-semibold text-white"
            >
              View plans
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="leading-relaxed text-[var(--b70-text-muted)]">{why}</p>
          {impact ? (
            <p className="text-[11px] text-[var(--b70-text)]">
              <span className="font-semibold text-[var(--b70-text-muted)]">Impact sketch · </span>
              {impact}
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-3">
        <Link
          href={`/opportunities/${opp.slug}`}
          className="text-[11px] font-semibold text-[var(--b70-crypto-blue)] hover:underline"
        >
          Open opportunity thesis →
        </Link>
      </div>
    </article>
  );
}
