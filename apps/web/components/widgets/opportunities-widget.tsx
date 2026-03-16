"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { getAlphaTop } from "@/lib/api";
import type { AlphaRankedOpportunity } from "@/lib/types";
import type { WidgetSettings } from "@/components/dashboard/widget-loader";

export function OpportunitiesWidget({
  widgetId,
  settings,
}: {
  widgetId: string;
  settings?: WidgetSettings;
}) {
  const [items, setItems] = useState<AlphaRankedOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAlphaTop()
      .then((data) => {
        if (!cancelled) setItems(data);
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
        title="Top opportunities"
        subtitle="By alpha score"
        action={
          <Link
            href="/opportunities"
            className="text-xs font-medium text-[var(--b70-crypto-blue)] hover:underline"
          >
            View all
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-500">No opportunities yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, settings?.limit ?? 5).map(({ opportunity, alpha_score }) => (
              <li key={opportunity.id}>
                <Link
                  href={`/opportunities/${opportunity.slug}`}
                  className="flex justify-between gap-2 rounded border border-[var(--b70-border)] px-2 py-1.5 text-xs hover:bg-[var(--b70-card-hover)]"
                >
                  <span className="truncate text-slate-200">
                    {opportunity.asset_symbol ?? opportunity.base_symbol ?? opportunity.type}
                  </span>
                  <span className="shrink-0 text-emerald-400">
                    {(alpha_score * 100).toFixed(0)}%
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
