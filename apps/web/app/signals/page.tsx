import { getSignalsLatest } from "@/lib/api";
import { RiskWarningBanner } from "@/components/legal/risk-warning-banner";
import { RiskBadge } from "@/components/legal/risk-badge";
import { SignalsFeedClient } from "./signals-feed-client";

export const revalidate = 30;

export default async function SignalsPage() {
  let initialSignals: Awaited<ReturnType<typeof getSignalsLatest>> = [];
  let error: string | null = null;

  try {
    initialSignals = await getSignalsLatest({ limit: 80 });
  } catch {
    error = "Unable to load the signals feed. Please try again shortly.";
  }

  return (
    <div className="space-y-6">
      <RiskWarningBanner />
      <section className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-50">Signals feed</h2>
            <RiskBadge />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time feed of wallet, market, radar, liquidity, and social signals.
          </p>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}
        </section>
      ) : null}

      <SignalsFeedClient initialSignals={initialSignals} />
    </div>
  );
}
