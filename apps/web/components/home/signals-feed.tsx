import Link from "next/link";
import type { SignalDto } from "@/lib/types";
import { SignalCard } from "@/components/signals/signal-card";

type SignalsFeedProps = {
  signals: SignalDto[];
};

export function SignalsFeed({ signals }: SignalsFeedProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">Signals feed</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Whale buys, volume spikes, radar & smart money
          </p>
        </div>
        <Link
          href="/signals"
          className="text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          View feed
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {signals.length === 0 ? (
          <p className="text-xs text-slate-500">
            No signals in the stream yet. As Block70 ingests wallets, DEXs, and
            radar, high-confidence events will land here first.
          </p>
        ) : (
          signals.slice(0, 5).map((sig) => (
            <div key={sig.id} className="transition-opacity duration-300">
              <SignalCard
                signal={sig}
                href={
                  sig.token_symbol
                    ? `/signals/${encodeURIComponent(sig.token_symbol)}`
                    : undefined
                }
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
