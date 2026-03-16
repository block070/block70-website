"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBotsPerformance } from "@/lib/admin-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminBotsPage() {
  const [data, setData] = useState<{
    bots: Array<{
      bot_id: number;
      platform: string;
      channel_id: string;
      is_active: boolean;
      signals_sent_24h: number;
      signals_sent_7d: number;
      clicks_7d: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBotsPerformance()
      .then(setData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Forbidden");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/admin/analytics">
          <Button variant="outline">← Analytics</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Bot performance</h1>
      </div>

      {error && (
        <p className="text-rose-400">{error}</p>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      ) : data?.bots?.length ? (
        <Card>
          <CardHeader
            title="Signals sent & engagement"
            subtitle="Per-bot signals and click-through (7d)"
          />
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">Platform</th>
                  <th className="px-4 py-2 font-medium">Channel</th>
                  <th className="px-4 py-2 font-medium text-right">Active</th>
                  <th className="px-4 py-2 font-medium text-right">Signals (24h)</th>
                  <th className="px-4 py-2 font-medium text-right">Signals (7d)</th>
                  <th className="px-4 py-2 font-medium text-right">Clicks (7d)</th>
                </tr>
              </thead>
              <tbody>
                {data.bots.map((b) => (
                  <tr key={b.bot_id} className="border-b border-[var(--b70-border)]">
                    <td className="px-4 py-2 font-medium text-slate-200 capitalize">{b.platform}</td>
                    <td className="px-4 py-2 text-slate-400">{b.channel_id}</td>
                    <td className="px-4 py-2 text-right">{b.is_active ? "Yes" : "No"}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{b.signals_sent_24h}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{b.signals_sent_7d}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{b.clicks_7d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <p className="text-slate-500">No bots or no data.</p>
      )}
    </div>
  );
}
