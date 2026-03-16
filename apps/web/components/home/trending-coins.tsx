import Link from "next/link";
import type { TrendingSignalTokenDto } from "@/lib/types";

type TrendingCoinsProps = {
  trending: TrendingSignalTokenDto[];
};

export function TrendingCoins({ trending }: TrendingCoinsProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">Trending coins</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            By volume, signals & social activity
          </p>
        </div>
        <Link
          href="/signals/trending"
          className="text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trending.length === 0 ? (
          <p className="col-span-full text-xs text-slate-500">
            No trending data yet.
          </p>
        ) : (
          trending.slice(0, 6).map((t, i) => (
            <Link
              key={`${t.token_symbol}-${i}`}
              href={`/signals/${encodeURIComponent(t.token_symbol || t.token_address || "-")}`}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm transition-colors hover:border-slate-700 hover:bg-slate-800/60"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">
                  {t.token_symbol || t.token_address || "—"}
                </span>
                <span className="text-[10px] text-slate-500">
                  {t.signal_count} signals
                </span>
              </div>
              <p className="mt-1 text-xs text-emerald-400">
                {(t.avg_confidence_score * 100).toFixed(0)}% confidence
              </p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
