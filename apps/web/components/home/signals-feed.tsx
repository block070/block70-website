import Link from "next/link";
import type { SignalDto } from "@/lib/types";
import { SignalCard } from "@/components/signals/signal-card";

type SignalsFeedProps = {
  signals: SignalDto[];
  errorMessage?: string | null;
};

export function SignalsFeed({ signals, errorMessage = null }: SignalsFeedProps) {
  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--b70-text)]">Signals feed</h3>
          <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
            Whale buys, volume spikes, radar & smart money
          </p>
        </div>
        <Link
          href="/signals"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View feed
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {errorMessage ? (
          <p className="text-xs text-[var(--b70-text-muted)]">
            Data temporarily unavailable.{" "}
            <span className="font-mono">{errorMessage}</span>
          </p>
        ) : signals.length === 0 ? (
          <p className="text-xs text-[var(--b70-text-muted)]">
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
