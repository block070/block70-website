import type { Coin } from "@/lib/crypto-mock";

type Props = {
  coin: Coin;
};

export function CoinDescription({ coin }: Props) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        Project description
      </p>
      <p className="text-slate-300">
        This is a mock description for {coin.name}. In the full Block70
        intelligence system, this section would blend protocol docs, research
        notes, risk disclosures, and AI summaries into a single narrative.
      </p>
      <p className="text-[11px] text-slate-400">
        For now, we&apos;re focused on getting the surface right and will plug
        in live fundamentals later.
      </p>
    </section>
  );
}

