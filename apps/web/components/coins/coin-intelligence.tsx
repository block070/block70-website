"use client";

import { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { getSubscription } from "@/lib/billing";
import {
  getAlphaFeed,
  getRadarEventsForToken,
  getWalletLeaderboard,
} from "@/lib/api";
import type { AlphaEvent, RadarEventDto, WalletLeaderboardEntry } from "@/lib/types";

type Props = {
  symbol: string;
};

type Plan = "free" | "pro" | "elite";

export function CoinIntelligence({ symbol }: Props) {
  const [plan, setPlan] = useState<Plan>("free");
  const [alphaSignals, setAlphaSignals] = useState<AlphaEvent[]>([]);
  const [radarEvents, setRadarEvents] = useState<RadarEventDto[]>([]);
  const [whales, setWhales] = useState<WalletLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [user, sub] = await Promise.all([
          getCurrentUser().catch(() => null),
          getSubscription().catch(() => null),
        ]);

        const effectivePlan = (sub?.plan_type ??
          user?.plan_type ??
          "free") as Plan;
        if (!active) return;
        setPlan(effectivePlan);

        if (effectivePlan === "free") {
          setLoading(false);
          return;
        }

        const [alpha, radar, wallets] = await Promise.all([
          getAlphaFeed(100).catch(() => []),
          getRadarEventsForToken(symbol).catch(() => []),
          getWalletLeaderboard().catch(() => []),
        ]);

        if (!active) return;

        const alphaForToken = alpha.filter(
          (event) =>
            event.token_symbol &&
            event.token_symbol.toUpperCase() === symbol.toUpperCase(),
        );

        setAlphaSignals(alphaForToken.slice(0, 5));
        setRadarEvents(radar.slice(0, 5));
        setWhales(wallets.slice(0, 5));
        setLoading(false);
      } catch {
        if (!active) return;
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [symbol]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Premium intelligence
        </p>
        <p className="mt-2 text-slate-400">Loading Block70 signals…</p>
      </section>
    );
  }

  if (plan === "free") {
    return (
      <section className="rounded-xl border border-emerald-500/40 bg-slate-900/60 p-4 text-xs">
        <p className="text-[11px] uppercase tracking-wide text-emerald-300">
          Premium intelligence
        </p>
        <p className="mt-2 text-slate-300">
          Upgrade to Pro or Elite to unlock alpha signals, radar alerts, and AI
          research for this coin.
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          This panel plugs directly into Block70&apos;s opportunity engine,
          wallet feeds, and radar pipelines.
        </p>
        <a
          href="/pricing"
          className="mt-3 inline-flex rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
        >
          View pricing
        </a>
      </section>
    );
  }

  const isElite = plan === "elite";

  return (
    <section className="space-y-3 rounded-xl border border-emerald-500/60 bg-slate-900/60 p-4 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-emerald-300">
          Premium intelligence · {plan.toUpperCase()}
        </p>
        {isElite && (
          <span className="rounded-full border border-emerald-500/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
            Elite depth
          </span>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Panel
          title="Alpha signals"
          emptyLabel="No alpha signals yet for this coin."
        >
          {alphaSignals.map((event) => (
            <div
              key={event.id}
              className="rounded-md border border-emerald-500/20 bg-slate-950/60 p-2"
            >
              <p className="text-[11px] font-medium text-slate-100">
                {event.event_type}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {event.summary}
              </p>
            </div>
          ))}
        </Panel>
        <Panel
          title="Radar alerts"
          emptyLabel="No radar events yet for this coin."
        >
          {radarEvents.map((event, idx) => (
            <div
              key={`${event.token_symbol}-${idx}`}
              className="rounded-md border border-emerald-500/20 bg-slate-950/60 p-2"
            >
              <p className="text-[11px] font-medium text-slate-100">
                Score {Math.round((event.event_score ?? 0) * 100)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {(event.signal_types ?? []).slice(0, 3).join(", ")}
              </p>
            </div>
          ))}
        </Panel>
        <Panel
          title="Whale activity"
          emptyLabel="No whale flows mapped yet."
        >
          {whales.map((wallet) => (
            <div
              key={wallet.wallet_address}
              className="rounded-md border border-emerald-500/20 bg-slate-950/60 p-2"
            >
              <p className="truncate text-[11px] font-medium text-slate-100">
                {wallet.wallet_address}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Win rate {Math.round(wallet.win_rate * 100)}% · PnL $
                {Math.round(wallet.total_profit_usd).toLocaleString()}
              </p>
            </div>
          ))}
        </Panel>
      </div>
      {isElite && (
        <p className="text-[11px] text-slate-400">
          Elite plan will eventually include deep AI research reports per coin,
          mapped directly to Block70 opportunities and execution routes.
        </p>
      )}
    </section>
  );
}

type PanelProps = {
  title: string;
  children: React.ReactNode;
  emptyLabel: string;
};

function Panel({ title, children, emptyLabel }: PanelProps) {
  const items = Array.isArray(children) ? children : [children];
  const hasContent = items.filter(Boolean).length > 0;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">
        {title}
      </p>
      {hasContent ? (
        <div className="space-y-1.5">{children}</div>
      ) : (
        <p className="text-[11px] text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

