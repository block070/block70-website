"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { trackExchangeClick, type ExchangeDto } from "@/lib/api";
import {
  type ExchangeCgDetailPayload,
  type ExchangeVolumeChartPayload,
  medianSpreadPercent,
  topCoinsByVolume,
} from "@/lib/exchange-liquidity-types";

function formatVolumeUsd(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  return `$${usd.toFixed(0)}`;
}

function formatBtcVol(btc: number): string {
  if (btc >= 1000) return `${(btc / 1000).toFixed(2)}k BTC`;
  if (btc >= 1) return `${btc.toFixed(1)} BTC`;
  return `${btc.toFixed(3)} BTC`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

type Props = { exchange: ExchangeDto };

function VolumeChartBlock({ cgId }: { cgId: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, error, isLoading } = useSWR(
    cgId ? `/api/v1/exchanges/${encodeURIComponent(cgId)}/volume-chart` : null,
    fetchJson<ExchangeVolumeChartPayload>,
    { revalidateOnFocus: false },
  );

  const chartRows = useMemo(() => {
    if (!data?.series?.length) return [];
    return data.series.map(([ts, vol]) => ({
      label: new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      vol,
    }));
  }, [data]);

  if (!mounted) {
    return (
      <div className="h-52 w-full rounded-lg bg-[var(--b70-bg)]" aria-hidden />
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-[var(--b70-text-muted)]">
        Loading chart…
      </div>
    );
  }
  if (error || !chartRows.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--b70-text-muted)]">
        Volume history unavailable.
      </div>
    );
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }}
            width={44}
            tickFormatter={(v) => formatBtcVol(Number(v))}
          />
          <RechartsTooltip
            contentStyle={{
              background: "var(--b70-card)",
              border: "1px solid var(--b70-border)",
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(v) =>
              [formatBtcVol(Number(v ?? 0)), "Volume"] as [string, string]
            }
          />
          <Line
            type="monotone"
            dataKey="vol"
            stroke="var(--b70-crypto-blue)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExchangeDetailClient({ exchange: ex }: Props) {
  const handleVisit = useCallback(() => {
    trackExchangeClick(ex.id);
    window.open(ex.final_url || ex.url, "_blank", "noopener,noreferrer");
  }, [ex.id, ex.final_url, ex.url]);

  const { data: detail, error: detailError } = useSWR(
    ex.id ? `/api/v1/exchanges/${encodeURIComponent(ex.id)}/detail` : null,
    fetchJson<ExchangeCgDetailPayload>,
    { revalidateOnFocus: false },
  );

  const medianSpread = useMemo(
    () => medianSpreadPercent(detail?.top_tickers ?? [], 25),
    [detail?.top_tickers],
  );

  const topCoins = useMemo(
    () => topCoinsByVolume(detail?.top_tickers ?? [], 12),
    [detail?.top_tickers],
  );

  const overviewText =
    detail?.description?.trim() ||
    `${ex.name} — trust score ${ex.trust_score}/10 (CoinGecko). Use top markets for a spread proxy; this is not on-chain reserve intelligence.`;

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <header className="flex flex-wrap items-center gap-4">
        {(detail?.image || ex.image) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail?.image || ex.image}
            alt=""
            width={64}
            height={64}
            className="rounded-2xl object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-[var(--b70-border)]" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-[var(--b70-text)]">
            {detail?.name || ex.name}
          </h1>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2.5 py-0.5 text-[var(--b70-text-muted)]">
              Rank #{detail?.trust_score_rank ?? ex.trust_score_rank}
            </span>
            <span className="rounded-full border border-[var(--b70-crypto-blue)]/30 bg-[var(--b70-crypto-blue)]/10 px-2.5 py-0.5 text-[var(--b70-crypto-blue)]">
              Trust {(detail?.trust_score ?? ex.trust_score).toFixed(1)}/10
            </span>
            <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2.5 py-0.5 text-[var(--b70-text)]">
              24h vol ~ {formatVolumeUsd(ex.trade_volume_24h_usd)}
            </span>
            {detail != null && detail.tickers_count > 0 ? (
              <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2.5 py-0.5 text-[var(--b70-text-muted)]">
                {detail.tickers_count.toLocaleString()} pairs (reported)
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {detailError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Could not load live market detail. Showing list snapshot only.
        </p>
      ) : null}

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Overview</h2>
        <p className="text-sm leading-relaxed text-[var(--b70-text-muted)]">{overviewText}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--b70-text-muted)]">Country</dt>
            <dd className="text-[var(--b70-text)]">{detail?.country ?? ex.country ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--b70-text-muted)]">Year established</dt>
            <dd className="text-[var(--b70-text)]">
              {detail?.year_established ?? ex.year_established ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--b70-text)]">Volume (30d)</h2>
          <span className="text-[10px] text-[var(--b70-text-muted)]">
            CoinGecko volume_chart (BTC units)
          </span>
        </div>
        <VolumeChartBlock cgId={ex.id} />
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-[var(--b70-text)]">Liquidity (spread proxy)</h2>
        <p className="mb-4 text-xs text-[var(--b70-text-muted)]">
          Median bid–ask spread % on the top {Math.min(25, detail?.top_tickers?.length ?? 0)} markets by
          reported USD volume—not depth or reserves.
        </p>
        {medianSpread != null ? (
          <p className="font-[family-name:var(--font-jetbrains)] text-2xl font-semibold text-[var(--b70-text)]">
            {medianSpread.toFixed(3)}%
          </p>
        ) : (
          <p className="text-sm text-[var(--b70-text-muted)]">Insufficient spread data in sample.</p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Top coins (by ticker volume)</h2>
        {topCoins.length ? (
          <ul className="flex flex-wrap gap-2">
            {topCoins.map((c) => (
              <li key={c.coin_id}>
                <Link
                  href={`/coins/${encodeURIComponent(c.coin_id)}`}
                  className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2.5 py-1 text-xs font-medium text-[var(--b70-text)] hover:border-[var(--b70-crypto-blue)]/50"
                >
                  {c.coin_id}{" "}
                  <span className="font-[family-name:var(--font-jetbrains)] font-normal text-[var(--b70-text-muted)]">
                    {formatVolumeUsd(c.volumeUsd)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--b70-text-muted)]">No coin breakdown yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--b70-text)]">Top markets</h2>
        {detail?.top_tickers?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-[var(--b70-border)] text-[var(--b70-text-muted)]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Pair</th>
                  <th className="py-2 pr-3 text-right font-medium">Vol (USD)</th>
                  <th className="py-2 pr-3 text-right font-medium">Spread %</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--b70-border)]">
                {detail.top_tickers.map((t, idx) => (
                  <tr
                    key={`${idx}-${t.base}-${t.target}`}
                    className="text-[var(--b70-text)]"
                  >
                    <td className="py-2 pr-3 font-medium">
                      {t.base}/{t.target}
                    </td>
                    <td className="py-2 pr-3 text-right font-[family-name:var(--font-jetbrains)]">
                      {formatVolumeUsd(t.converted_volume_usd)}
                    </td>
                    <td className="py-2 pr-3 text-right font-[family-name:var(--font-jetbrains)]">
                      {t.bid_ask_spread_percentage != null
                        ? `${t.bid_ask_spread_percentage.toFixed(3)}`
                        : "—"}
                    </td>
                    <td className="py-2">
                      {t.trade_url ? (
                        <a
                          href={t.trade_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--b70-crypto-blue)] hover:underline"
                        >
                          Trade
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--b70-text-muted)]">No ticker sample loaded.</p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--b70-crypto-blue)]/25 bg-[var(--b70-crypto-blue)]/5 p-8 text-center">
        <p className="mb-2 text-sm text-[var(--b70-text-muted)]">
          Trade on {detail?.name || ex.name} via the venue
        </p>
        <button
          type="button"
          onClick={handleVisit}
          className="inline-flex items-center rounded-xl bg-[var(--b70-crypto-blue)] px-8 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Open exchange
        </button>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--b70-border)] bg-[var(--b70-card)] p-4 md:hidden">
        <button
          type="button"
          onClick={handleVisit}
          className="w-full rounded-xl bg-[var(--b70-crypto-blue)] py-3 text-sm font-semibold text-white"
        >
          Open exchange
        </button>
      </div>

      <p className="text-[10px] text-[var(--b70-text-muted)]">
        Exchange and market data from{" "}
        <a
          href="https://www.coingecko.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--b70-crypto-blue)] hover:underline"
        >
          CoinGecko
        </a>
        . Not financial advice.
      </p>

      <p className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/exchanges" className="text-[var(--b70-crypto-blue)] hover:underline">
          ← Back to exchanges
        </Link>
      </p>
    </div>
  );
}
