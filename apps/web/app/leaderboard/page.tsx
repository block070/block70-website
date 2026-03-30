"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getTradersLeaderboard,
  type TraderLeaderboardEntry,
  type TraderLeaderboardPeriod,
  type TraderLeaderboardSort,
} from "@/lib/leaderboard-api";
import { getBlocksLeaderboard, type LeaderboardEntry } from "@/lib/rewards-api";
import { getPublicStrategies, type TradingStrategyDto } from "@/lib/trading-strategies-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PERIODS: { value: TraderLeaderboardPeriod; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function badgeLabel(code: string): string {
  const map: Record<string, string> = {
    champion: "Champion",
    runner_up: "2nd place",
    third: "3rd place",
    elite: "Top 10",
    proven: "Proven",
    community_star: "Community star",
  };
  return map[code] ?? code;
}

export default function LeaderboardPage() {
  const [mainTab, setMainTab] = useState<"performance" | "blocks">("performance");
  const [sort, setSort] = useState<TraderLeaderboardSort>("roi");
  const [period, setPeriod] = useState<TraderLeaderboardPeriod>("all");
  const [strategyId, setStrategyId] = useState<string>("");
  const [strategies, setStrategies] = useState<TradingStrategyDto[]>([]);
  const [traders, setTraders] = useState<TraderLeaderboardEntry[]>([]);
  const [blocksEntries, setBlocksEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTraders = useCallback(() => {
    setLoading(true);
    setError(null);
    const sid = strategyId === "" ? null : Number(strategyId);
    getTradersLeaderboard({
      sort,
      period,
      strategyId: Number.isFinite(sid as number) ? sid : null,
      publicOnly: true,
      limit: 100,
    })
      .then(setTraders)
      .catch(() => {
        setError("Could not load trader rankings.");
        setTraders([]);
      })
      .finally(() => setLoading(false));
  }, [sort, period, strategyId]);

  useEffect(() => {
    getPublicStrategies(100)
      .then(setStrategies)
      .catch(() => setStrategies([]));
  }, []);

  useEffect(() => {
    if (mainTab !== "performance") return;
    loadTraders();
  }, [mainTab, loadTraders]);

  useEffect(() => {
    if (mainTab !== "blocks") return;
    setBlocksLoading(true);
    getBlocksLeaderboard(100)
      .then(setBlocksEntries)
      .catch(() => setBlocksEntries([]))
      .finally(() => setBlocksLoading(false));
  }, [mainTab]);

  const top3 = traders.slice(0, 3);
  const rest = traders.slice(3);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline">← Back</Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-50">Leaderboard</h1>
        </div>
        <p className="max-w-xl text-sm text-slate-400">
          Compete on simulated strategy performance.{" "}
          <Link
            href="/strategies/leaderboard"
            className="text-amber-300/90 underline-offset-2 hover:underline"
          >
            Strategy-only rankings
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] p-1">
        <button
          type="button"
          onClick={() => setMainTab("performance")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mainTab === "performance"
              ? "bg-amber-500/20 text-amber-200"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Performance
        </button>
        <button
          type="button"
          onClick={() => setMainTab("blocks")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mainTab === "blocks"
              ? "bg-amber-500/20 text-amber-200"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Blocks
        </button>
      </div>

      {mainTab === "performance" ? (
        <>
          <p className="text-slate-400">
            Ranked by public strategy backtests. Filter by time window and strategy; sort by ROI or win rate.
          </p>

          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Sort by
              </label>
              <div className="flex rounded-lg border border-[var(--b70-border)] p-1">
                {(
                  [
                    { v: "roi" as const, l: "ROI" },
                    { v: "win_rate" as const, l: "Win rate" },
                  ] as const
                ).map(({ v, l }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSort(v)}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      sort === v
                        ? "bg-slate-700 text-slate-100"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="lb-period"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Period
              </label>
              <select
                id="lb-period"
                value={period}
                onChange={(e) =>
                  setPeriod(e.target.value as TraderLeaderboardPeriod)
                }
                className="w-full min-w-[10rem] rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-slate-100"
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[12rem] flex-1 lg:max-w-md">
              <label
                htmlFor="lb-strategy"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                Strategy
              </label>
              <select
                id="lb-strategy"
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
                className="w-full rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All public strategies</option>
                {strategies.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.strategy_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p className="text-rose-400">{error}</p>
          ) : null}

          {loading ? (
            <div className="h-48 animate-pulse rounded-lg bg-[var(--b70-border)]" />
          ) : traders.length === 0 ? (
            <Card>
              <CardHeader
                title="No rankings yet"
                subtitle="Public strategies need backtests in the selected window."
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {top3.map((e, i) => {
                  const heights = ["md:order-2 md:pt-0", "md:order-1 md:pt-6", "md:order-3 md:pt-8"];
                  const accents = [
                    "border-amber-400/40 shadow-amber-500/10",
                    "border-slate-400/30",
                    "border-amber-700/35",
                  ][i] ?? "border-[var(--b70-border)]";
                  return (
                    <Card
                      key={e.user_id}
                      className={`overflow-hidden ${heights[i] ?? ""} border-2 ${accents}`}
                    >
                      <div
                        className={`px-4 py-3 text-center text-lg font-bold ${
                          i === 0
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-[var(--b70-border)]/30 text-slate-200"
                        }`}
                      >
                        #{e.rank}
                      </div>
                      <div className="space-y-2 p-4 text-center">
                        <Link
                          href={`/community/users/${e.user_id}`}
                          className="font-semibold text-slate-100 hover:text-amber-200 hover:underline"
                        >
                          {e.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500" title={e.strategy_name}>
                          {e.strategy_name}
                        </p>
                        <div className="flex justify-center gap-4 font-mono text-sm">
                          <div>
                            <p className="text-[10px] uppercase text-slate-500">ROI</p>
                            <p className="text-emerald-300">{e.roi.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-slate-500">Win</p>
                            <p className="text-sky-300">
                              {(e.win_rate * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        {e.badges.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1 pt-1">
                            {e.badges.map((b) => (
                              <span
                                key={b}
                                className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-amber-200/90"
                              >
                                {badgeLabel(b)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {rest.length > 0 ? (
                <Card hover={false} className="hover:translate-y-0">
                  <CardHeader
                    title="Full rankings"
                    subtitle={`Sorted by ${sort === "roi" ? "ROI" : "win rate"}`}
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                          <th className="px-4 py-2 font-medium">Rank</th>
                          <th className="px-4 py-2 font-medium">Trader</th>
                          <th className="px-4 py-2 font-medium">Strategy</th>
                          <th className="px-4 py-2 text-right font-medium">ROI</th>
                          <th className="px-4 py-2 text-right font-medium">Win rate</th>
                          <th className="px-4 py-2 text-right font-medium">Trades</th>
                          <th className="px-4 py-2 font-medium">Recognition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rest.map((e) => (
                          <tr
                            key={e.user_id}
                            className="border-b border-[var(--b70-border)] last:border-0"
                          >
                            <td className="px-4 py-2 font-medium text-slate-400">
                              #{e.rank}
                            </td>
                            <td className="px-4 py-2">
                              <Link
                                href={`/community/users/${e.user_id}`}
                                className="text-slate-200 hover:text-amber-200 hover:underline"
                              >
                                {e.name}
                              </Link>
                            </td>
                            <td
                              className="max-w-[10rem] truncate px-4 py-2 text-slate-500"
                              title={e.strategy_name}
                            >
                              {e.strategy_name}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-emerald-300">
                              {e.roi.toFixed(2)}%
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-sky-300">
                              {(e.win_rate * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-slate-300">
                              {e.total_trades}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                {e.badges.map((b) => (
                                  <span
                                    key={b}
                                    className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-amber-200/85"
                                  >
                                    {badgeLabel(b)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-slate-400">
            Top users by Blocks balance. Earn Blocks from check-ins, referrals, alpha posts, and more.
          </p>
          <Card>
            <CardHeader title="Rank by Blocks" subtitle="Top 100" />
            <div className="overflow-x-auto">
              {blocksLoading ? (
                <div className="h-48 animate-pulse rounded bg-[var(--b70-border)] p-4" />
              ) : blocksEntries.length === 0 ? (
                <p className="p-4 text-slate-500">No data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                      <th className="px-4 py-2 font-medium">Rank</th>
                      <th className="px-4 py-2 font-medium">User</th>
                      <th className="px-4 py-2 font-medium text-right">Blocks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocksEntries.map((e) => (
                      <tr
                        key={e.user_id}
                        className="border-b border-[var(--b70-border)] last:border-0"
                      >
                        <td className="px-4 py-2 font-medium text-slate-300">#{e.rank}</td>
                        <td className="px-4 py-2 text-slate-200">
                          <Link
                            href={`/community/users/${e.user_id}`}
                            className="hover:text-amber-200 hover:underline"
                          >
                            {e.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-amber-300">
                          {Math.floor(e.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
