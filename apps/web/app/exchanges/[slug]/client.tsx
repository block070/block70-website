"use client";

import { useCallback } from "react";
import Link from "next/link";
import { trackExchangeClick, type ExchangeDto } from "@/lib/api";

function formatVolume(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  return `$${usd.toFixed(0)}`;
}

type Props = { exchange: ExchangeDto };

export function ExchangeDetailClient({ exchange: ex }: Props) {
  const handleVisit = useCallback(() => {
    trackExchangeClick(ex.id);
    window.open(ex.final_url || ex.url, "_blank", "noopener,noreferrer");
  }, [ex.id, ex.final_url, ex.url]);

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <header className="flex flex-wrap items-center gap-4">
        {ex.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ex.image}
            alt=""
            width={64}
            height={64}
            className="rounded-2xl object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-slate-700" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-50">{ex.name}</h1>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-slate-300">
              Rank #{ex.trust_score_rank}
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-emerald-400">
              Trust Score {ex.trust_score}/10
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-slate-300">
              24h Vol {formatVolume(ex.trade_volume_24h_usd)}
            </span>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-50">Overview</h2>
        <p className="text-sm text-slate-400">
          {ex.name} is a leading cryptocurrency exchange with a trust score of{" "}
          {ex.trust_score}/10. Trade spot and derivatives with deep liquidity.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Country</dt>
            <dd className="text-slate-200">{ex.country ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Year Established</dt>
            <dd className="text-slate-200">{ex.year_established ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-50">Key Stats</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-xs text-slate-500">24h Volume</p>
            <p className="mt-1 text-xl font-bold text-emerald-400">
              {formatVolume(ex.trade_volume_24h_usd)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-xs text-slate-500">Trust Score</p>
            <p className="mt-1 text-xl font-bold text-slate-200">
              {ex.trust_score}/10
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <p className="text-xs text-slate-500">Rank</p>
            <p className="mt-1 text-xl font-bold text-slate-200">#{ex.trust_score_rank}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-50">
          Why use this exchange?
        </h2>
        <ul className="space-y-2 text-sm text-slate-400">
          <li>• Trusted by millions of traders worldwide</li>
          <li>• Competitive fees and deep liquidity</li>
          <li>• Secure custody and regulatory compliance</li>
        </ul>
      </section>

      <section className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-8 text-center">
        <p className="mb-2 text-sm text-slate-300">
          Join millions trading on {ex.name}
        </p>
        <button
          type="button"
          onClick={handleVisit}
          className="inline-flex items-center rounded-xl bg-emerald-500 px-8 py-4 text-lg font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Trade on {ex.name}
        </button>
      </section>

      {/* Sticky CTA on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950 p-4 md:hidden">
        <button
          type="button"
          onClick={handleVisit}
          className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950"
        >
          Trade on {ex.name}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        <Link href="/exchanges" className="text-crypto-blue hover:underline">
          ← Back to Exchanges
        </Link>
      </p>
    </div>
  );
}
