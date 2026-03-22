import { getSignalsLatest } from "@/lib/api";
import { NarrativesSection } from "@/components/home/narratives-section";
import { SignalsFeed } from "@/components/home/signals-feed";
import { withTimeout } from "@/lib/with-timeout";

const FETCH_TIMEOUT_MS = 6_000;

export async function SignalsSection() {
  let signals: Awaited<ReturnType<typeof getSignalsLatest>> = [];
  let signalsError: string | null = null;

  try {
    signals = await withTimeout(
      getSignalsLatest({ limit: 10 }),
      FETCH_TIMEOUT_MS
    );
  } catch (e) {
    signalsError = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <NarrativesSection />
      <SignalsFeed signals={signals} errorMessage={signalsError} />
    </section>
  );
}
