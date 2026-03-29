import Link from "next/link";

type Props = {
  name: string;
  symbol: string;
};

export function CoinWhaleActivity({ name, symbol }: Props) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        Whale &amp; smart money
      </h2>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Large holders and institutional-style flows can move {name} ({symbol}) ahead of retail
        spot moves. Block70 surfaces wallet intelligence, capital flow, and radar-style events
        across the platform — use them together with price and your own risk rules.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/capitalflow"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:border-crypto-blue/50 hover:text-crypto-blue"
        >
          Capital flows
        </Link>
        <Link
          href="/smartwallets"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:border-crypto-blue/50 hover:text-crypto-blue"
        >
          Smart money wallets
        </Link>
        <Link
          href={`/signals/${encodeURIComponent(symbol)}`}
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:border-crypto-blue/50 hover:text-crypto-blue"
        >
          {symbol} signals
        </Link>
        <Link
          href="/radar"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:border-crypto-blue/50 hover:text-crypto-blue"
        >
          Radar
        </Link>
      </div>
    </section>
  );
}
