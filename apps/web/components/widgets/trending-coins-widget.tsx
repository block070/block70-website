"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getSignalsTrending } from "@/lib/api";
import type { TrendingSignalTokenDto } from "@/lib/types";
import type { WidgetSettings } from "@/components/dashboard/widget-loader";

export function TrendingCoinsWidget({
  widgetId,
  settings,
}: {
  widgetId: string;
  settings?: WidgetSettings;
}) {
  const [tokens, setTokens] = useState<TrendingSignalTokenDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSignalsTrending({ limit: settings?.limit ?? 8 })
      .then((data) => {
        if (!cancelled) setTokens(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings?.limit]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Trending coins"
        subtitle="Trending tokens"
        action={
          <Link
            href="/signals/trending"
            className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            View all
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-slate-500">No trending data yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {tokens.slice(0, settings?.limit ?? 8).map((t, i) => (
              <li key={`${t.token_symbol}-${t.chain}-${i}`}>
                <Link
                  href={`/signals/${encodeURIComponent(t.token_symbol || t.token_address || "-")}`}
                  className="rounded border border-[var(--b70-border)] px-2 py-1 text-xs text-slate-200 hover:bg-[var(--b70-card-hover)]"
                >
                  {t.token_symbol || t.token_address || "—"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
