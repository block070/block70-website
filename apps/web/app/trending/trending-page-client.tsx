"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

type TrendingCoin = {
  name: string;
  symbol: string;
  rank: number;
  price: number | null;
  image: string | null;
  coingecko_id: string | null;
  score: number | null;
};

export function TrendingPageClient() {
  const [coins, setCoins] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch(
          `${API_BASE_URL || ""}/api/v1/market/trending?limit=20`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load trending coins");
        const data = (await res.json()) as TrendingCoin[];
        setCoins(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load trending coins right now.");
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
          <p className="text-sm text-slate-400">Loading trending coins…</p>
        </header>
        <div className="h-40 rounded-xl border border-slate-800 bg-slate-950/60 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Trending</h1>
        <p className="text-sm text-slate-400">
          Live CoinGecko trending coins, proxied via the Block70 backend.
        </p>
      </header>
      {error ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-xs text-red-200">
          {error}
        </div>
      ) : coins.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
          No trending data from CoinGecko yet. Try refreshing in a few seconds.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Coin</th>
                <th className="px-3 py-2 font-medium text-right">Price (BTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {coins.map((coin) => (
                <tr key={coin.coingecko_id ?? `${coin.symbol}-${coin.rank}`}>
                  <td className="px-3 py-2 text-slate-500">{coin.rank ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {coin.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coin.image}
                          alt={coin.name}
                          className="h-4 w-4 rounded-full"
                        />
                      ) : null}
                      <span className="text-sm font-medium text-slate-50">
                        {coin.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {coin.symbol}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-50">
                    {coin.price != null ? coin.price.toPrecision(4) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
