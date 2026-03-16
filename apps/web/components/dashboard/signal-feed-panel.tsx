import { getSignalsLatest } from "@/lib/api";
import { SignalCard } from "@/components/signals/signal-card";
import Link from "next/link";

export const revalidate = 30;

export async function SignalFeedPanel() {
  let signals: Awaited<ReturnType<typeof getSignalsLatest>> = [];

  try {
    signals = await getSignalsLatest({ limit: 8 });
  } catch {
    // leave empty
  }

  if (signals.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-50">Latest signals</h3>
          <Link
            href="/signals"
            className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
          >
            View all
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">No signals in the feed yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-50">Latest signals</h3>
        <Link
          href="/signals"
          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
        >
          View all
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {signals.slice(0, 6).map((signal) => (
          <SignalCard
            key={signal.id}
            signal={signal}
            href={
              signal.token_symbol
                ? `/signals/${encodeURIComponent(signal.token_symbol)}`
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
