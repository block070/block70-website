"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiKeyAnalytics } from "@/lib/developers-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DevelopersAnalyticsPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getApiKeyAnalytics>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    getApiKeyAnalytics(days)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const errorRate =
    data && data.total_requests > 0
      ? ((data.total_errors / data.total_requests) * 100).toFixed(1)
      : "0";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/developers">
            <Button variant="outline" className="px-3 py-1.5 text-xs">
              ← API keys
            </Button>
          </Link>
          <Link href="/apidocs">
            <Button variant="outline" className="px-3 py-1.5 text-xs">
              API reference
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              API usage
            </h1>
            <p className="text-sm text-slate-500">Requests and HTTP errors over time</p>
          </div>
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500">Total requests</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
                  {data.total_requests.toLocaleString()}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500">Errors (4xx/5xx)</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-300">
                  {data.total_errors.toLocaleString()}
                </p>
              </div>
            </Card>
            <Card>
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500">Error rate</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
                  {errorRate}%
                </p>
              </div>
            </Card>
          </div>

          {data.by_day.length > 0 && (
            <Card>
              <CardHeader
                title="Requests per day"
                subtitle="Green = successful; red segment = errors logged"
              />
              <div className="space-y-2 p-4">
                {data.by_day.map((row) => {
                  const max = Math.max(...data.by_day.map((d) => d.requests), 1);
                  const w = row.requests > 0 ? (row.requests / max) * 100 : 0;
                  const errPct = row.requests > 0 ? (row.errors / row.requests) * 100 : 0;
                  return (
                    <div key={row.date} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 text-xs text-slate-500">
                        {new Date(row.date).toLocaleDateString()}
                      </span>
                      <div className="h-6 min-w-0 flex-1 overflow-hidden rounded bg-slate-800">
                        <div className="flex h-full w-full">
                          <div
                            className="h-full bg-emerald-600/70"
                            style={{ width: `${(w * (100 - errPct)) / 100}%` }}
                          />
                          <div
                            className="h-full bg-rose-500/90"
                            style={{ width: `${(w * errPct) / 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-24 shrink-0 text-right tabular-nums text-slate-400">
                        {row.requests}
                        {row.errors > 0 && (
                          <span className="ml-1 text-rose-400">({row.errors})</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="By API key"
              subtitle={`${data.period_days}-day window`}
            />
            <div className="overflow-x-auto p-4">
              {data.by_key.length === 0 ? (
                <p className="text-slate-500">No usage yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                      <th className="px-4 py-2 font-medium">Key</th>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Plan</th>
                      <th className="px-4 py-2 font-medium text-right">Requests</th>
                      <th className="px-4 py-2 font-medium text-right">Errors</th>
                      <th className="px-4 py-2 font-medium text-right">Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_key.map((k) => (
                      <tr key={k.api_key_id} className="border-b border-[var(--b70-border)]">
                        <td className="px-4 py-2 font-mono text-slate-300">{k.key_prefix}…</td>
                        <td className="px-4 py-2 text-slate-400">{k.key_label || "—"}</td>
                        <td className="px-4 py-2 text-slate-400">{k.plan_type}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-300">
                          {k.request_count}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-rose-300">
                          {k.error_count}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-300">
                          {k.usage_today}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top endpoints" subtitle="By successful + error volume" />
              <div className="max-h-80 overflow-y-auto p-4">
                {data.by_endpoint.length === 0 ? (
                  <p className="text-slate-500">No data.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 font-medium">Path</th>
                        <th className="pb-2 text-right font-medium">Hits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_endpoint.map((e) => (
                        <tr key={e.endpoint} className="border-t border-slate-800">
                          <td className="py-1.5 font-mono text-xs text-slate-300">{e.endpoint}</td>
                          <td className="py-1.5 text-right tabular-nums text-slate-400">
                            {e.request_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Error endpoints" subtitle="4xx/5xx only" />
              <div className="max-h-80 overflow-y-auto p-4">
                {data.errors_by_endpoint.length === 0 ? (
                  <p className="text-slate-500">No errors in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="pb-2 font-medium">Path</th>
                        <th className="pb-2 text-right font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.errors_by_endpoint.map((e) => (
                        <tr key={e.endpoint} className="border-t border-slate-800">
                          <td className="py-1.5 font-mono text-xs text-rose-200">{e.endpoint}</td>
                          <td className="py-1.5 text-right tabular-nums text-rose-300">
                            {e.request_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
