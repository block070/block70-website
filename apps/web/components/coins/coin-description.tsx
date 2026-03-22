import type { Coin } from "@/lib/crypto-mock";

type Props = {
  coin: Coin;
  description?: string | null;
};

/** Fallback paragraph when no description is provided. Ensures every coin page has content. */
function defaultDescription(coin: Coin): string {
  return `${coin.name} (${coin.symbol}) is a cryptocurrency tracked on Block70. View live price, market cap, 24h volume, and community insights on this page.`;
}

export function CoinDescription({ coin, description }: Props) {
  const text = description?.trim() || defaultDescription(coin);
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        Project description
      </p>
      <p className="whitespace-pre-wrap text-slate-300">{text}</p>
    </section>
  );
}

