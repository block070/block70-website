"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Coin } from "@/lib/crypto-mock";
import { formatChangePct, formatCompactUsd, formatPrice } from "@/lib/format";

type Props = {
  coins: Coin[];
};

export function CoinTable({ coins }: Props) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-900/80 text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Coin</th>
            <th className="px-3 py-2 font-medium text-right">Price</th>
            <th className="px-3 py-2 font-medium text-right">24h</th>
            <th className="px-3 py-2 font-medium text-right">7d</th>
            <th className="px-3 py-2 font-medium text-right">Market cap</th>
            <th className="px-3 py-2 font-medium text-right">24h volume</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {coins.map((coin) => (
            <tr
              key={coin.id}
              className="hover:bg-slate-900/60 cursor-pointer"
              onClick={() => {
                router.push(`/coins/${coin.slug}`);
              }}
            >
              <td className="px-3 py-2 text-slate-500">{coin.rank}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/coins/${coin.slug}`}
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 object-cover">
                    {coin.logoUrl ? (
                      <img
                        src={coin.logoUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">
                        {(coin.symbol || coin.name?.[0] || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-medium text-slate-50">
                    {coin.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {coin.symbol}
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2 text-right text-slate-50">
                {formatPrice(coin.priceUsd)}
              </td>
              <td
                className={`px-3 py-2 text-right ${
                  typeof coin.change24hPct === "number" && Number.isFinite(coin.change24hPct)
                    ? coin.change24hPct >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                    : "text-slate-500"
                }`}
              >
                {formatChangePct(coin.change24hPct)}
              </td>
              <td
                className={`px-3 py-2 text-right ${
                  typeof coin.change7dPct === "number" && Number.isFinite(coin.change7dPct)
                    ? coin.change7dPct >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                    : "text-slate-500"
                }`}
              >
                {formatChangePct(coin.change7dPct)}
              </td>
              <td className="px-3 py-2 text-right text-slate-200">
                {formatCompactUsd(coin.marketCapUsd)}
              </td>
              <td className="px-3 py-2 text-right text-slate-200">
                {formatCompactUsd(coin.volume24hUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

