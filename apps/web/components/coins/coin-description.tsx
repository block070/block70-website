import type { Coin } from "@/lib/crypto-mock";

type Props = {
  coin: Coin;
  description?: string | null;
};

export function CoinDescription({ coin, description }: Props) {
  const text = description?.trim() || null;
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        Project description
      </p>
      {text ? (
        <p className="whitespace-pre-wrap text-slate-300">{text}</p>
      ) : (
        <p className="text-slate-500">
          No description available for {coin.name}.
        </p>
      )}
    </section>
  );
}

