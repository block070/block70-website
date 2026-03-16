"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";
import { getCopilotInsights, type CopilotInsightDto } from "@/lib/copilot-api";
import { CopilotAlert } from "@/components/copilot/copilot-alert";

export default function CopilotFeedPage() {
  const [insights, setInsights] = useState<CopilotInsightDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuth = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    if (!isAuth) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    getCopilotInsights({ limit: 50 })
      .then((data) => { if (!cancelled) setInsights(data); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuth]);

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">Copilot Feed</h1>
        <p className="text-sm text-[var(--b70-text-muted)]">Log in to see your personalized AI insight feed.</p>
        <Link href="/login" className="inline-block rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90">Log in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">Copilot Feed</h1>
        <Link href="/copilot" className="text-sm font-medium text-crypto-blue hover:underline">Dashboard</Link>
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">{error}</div>
      ) : loading ? (
        <p className="text-sm text-[var(--b70-text-muted)]">Loading feed…</p>
      ) : insights.length === 0 ? (
        <p className="text-sm text-[var(--b70-text-muted)]">No insights yet. Go to the Copilot dashboard and click “Generate insights”.</p>
      ) : (
        <ul className="space-y-4">
          {insights.map((i) => (
            <li key={i.id}>
              <CopilotAlert insight={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
