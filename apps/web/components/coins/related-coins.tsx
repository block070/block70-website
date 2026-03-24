import Link from "next/link";
import { CoinSymbol } from "@/components/market/coin-symbol";
import type { CoinListItemDto } from "@/lib/coins";
import { formatChangePct, formatPrice } from "@/lib/format";

type Props = {
  items: CoinListItemDto[];
  currentSlug: string;
};

export function RelatedCoins({ items, currentSlug }: Props) {
  const filtered = items.filter((i) => i.coin.slug !== currentSlug).slice(0, 8);
  if (!filtered.length) return null;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        Related coins
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Other large-cap names by market data. Explore more on the full market list.
      </p>
      <ul className="mt-3 divide-y divide-slate-800">
        {filtered.map((item) => {
          const c = item.coin;
          const md = item.latest_market_data;
          const ch = md?.price_change_24h;
          return (
            <li key={c.slug}>
              <Link
                href={`/coins/${c.slug}`}
                className="flex items-center justify-between gap-3 py-2.5 transition hover:bg-slate-800/40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CoinSymbol
                    symbol={c.symbol}
                    logoUrl={c.logo_url ?? undefined}
                    name={c.name}
                    size="sm"
                    iconOnly
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {c.name}
                    </span>
                    <span className="text-[11px] text-slate-500">{c.symbol}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block tabular-nums text-slate-200">
                    {formatPrice(c.price ?? md?.price ?? 0)}
                  </span>
                  <span
                    className={
                      typeof ch === "number" && Number.isFinite(ch)
                        ? ch >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                        : "text-slate-500"
                    }
                  >
                    {formatChangePct(ch ?? Number.NaN)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/coins"
        className="mt-3 inline-block text-xs font-medium text-crypto-blue hover:underline"
      >
        View all coins →
      </Link>
    </section>
  );
}
