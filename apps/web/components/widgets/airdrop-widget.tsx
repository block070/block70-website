"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getAirdrops } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import type { WidgetSettings } from "@/components/dashboard/widget-loader";

export function AirdropWidget({
  widgetId,
  settings,
}: {
  widgetId: string;
  settings?: WidgetSettings;
}) {
  const [airdrops, setAirdrops] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAirdrops()
      .then((data) => {
        if (!cancelled) setAirdrops(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Airdrops"
        subtitle="Active and high-value"
        action={
          <Link
            href="/airdrops"
            className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            View all
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : airdrops.length === 0 ? (
          <p className="text-xs text-slate-500">No airdrops yet.</p>
        ) : (
          <ul className="space-y-2">
            {airdrops.slice(0, settings?.limit ?? 5).map((a) => (
              <li key={a.id}>
                <Link
                  href={`/opportunities/${a.slug}`}
                  className="flex justify-between gap-2 rounded border border-[var(--b70-border)] px-2 py-1.5 text-xs hover:bg-[var(--b70-card-hover)]"
                >
                  <span className="truncate text-slate-200">
                    {a.asset_symbol ?? a.title ?? a.type}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {(a.total_score * 100).toFixed(0)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
