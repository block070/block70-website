"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getSignalsLatest } from "@/lib/api";
import type { SignalDto } from "@/lib/types";
import type { WidgetSettings } from "@/components/dashboard/widget-loader";

export function SignalsWidget({
  widgetId,
  settings,
}: {
  widgetId: string;
  settings?: WidgetSettings;
}) {
  const [signals, setSignals] = useState<SignalDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSignalsLatest({
      limit: settings?.limit ?? 6,
      chain: settings?.chain,
      signal_type: settings?.signal_type,
    })
      .then((data) => {
        if (!cancelled) setSignals(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings?.limit, settings?.chain, settings?.signal_type]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Latest signals"
        subtitle="Compact feed"
        action={
          <Link
            href="/signals"
            className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            View all
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : signals.length === 0 ? (
          <p className="text-xs text-slate-500">No signals yet.</p>
        ) : (
          <ul className="space-y-2">
            {signals.map((s) => (
              <li key={s.id} className="text-xs">
                <Link
                  href={
                    s.token_symbol
                      ? `/signals/${encodeURIComponent(s.token_symbol)}`
                      : "/signals"
                  }
                  className="flex justify-between gap-2 rounded border border-[var(--b70-border)] px-2 py-1.5 hover:bg-[var(--b70-card-hover)]"
                >
                  <span className="font-medium text-slate-200 truncate">
                    {s.token_symbol || s.token_address || "—"}
                  </span>
                  <span className="text-slate-500 shrink-0">{s.signal_type}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
