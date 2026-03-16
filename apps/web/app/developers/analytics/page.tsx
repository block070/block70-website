"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiKeyAnalytics } from "@/lib/developers-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DevelopersAnalyticsPage() {
  const [data, setData] = useState<{
    period_days: number;
    by_key: Array<{
      api_key_id: number;
      key_prefix: string;
      plan_type: string;
      request_count: number;
      usage_today: number;
    }>;
    by_endpoint: Array<{ endpoint: string; request_count: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    getApiKeyAnalytics(days)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/developers">
            <Button variant="outline">← Dashboard</Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-50">API usage analytics</h1>
        </div>
        <select
          className="rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      ) : !data ? (
        <p className="text-rose-400">Failed to load analytics.</p>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Usage by API key"
              subtitle={`Request counts over the last ${data.period_days} days`}
            />
            <div className="overflow-x-auto p-4">
              {data.by_key.length === 0 ? (
                <p className="text-slate-500">No usage yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                      <th className="px-4 py-2 font-medium">Key</th>
                      <th className="px-4 py-2 font-medium">Plan</th>
                      <th className="px-4 py-2 font-medium text-right">Requests (period)</th>
                      <th className="px-4 py-2 font-medium text-right">Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_key.map((k) => (
                      <tr key={k.api_key_id} className="border-b border-[var(--b70-border)]">
                        <td className="px-4 py-2 font-mono text-slate-300">{k.key_prefix}…</td>
                        <td className="px-4 py-2 text-slate-400">{k.plan_type}</td>
                        <td className="px-4 py-2 text-right text-slate-300">{k.request_count}</td>
                        <td className="px-4 py-2 text-right text-slate-300">{k.usage_today}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Usage by endpoint"
              subtitle="Request counts by path"
            />
            <div className="overflow-x-auto p-4">
              {data.by_endpoint.length === 0 ? (
                <p className="text-slate-500">No endpoint data yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                      <th className="px-4 py-2 font-medium">Endpoint</th>
                      <th className="px-4 py-2 font-medium text-right">Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_endpoint.map((e) => (
                      <tr key={e.endpoint} className="border-b border-[var(--b70-border)]">
                        <td className="px-4 py-2 font-mono text-slate-300">{e.endpoint}</td>
                        <td className="px-4 py-2 text-right text-slate-300">{e.request_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
