"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getStatus, triggerNewsScraper, type StatusResponse, type JobStatus } from "@/lib/status-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 5000;

function JobRow({ job }: { job: JobStatus }) {
  const statusColor =
    job.last_status === "success"
      ? "text-emerald-500"
      : job.last_status === "error"
        ? "text-rose-500"
        : "text-slate-500";

  return (
    <tr className="border-b border-[var(--b70-border)] last:border-0">
      <td className="px-4 py-3 font-medium text-[var(--b70-text)]">{job.label}</td>
      <td className="px-4 py-3 text-sm text-[var(--b70-text-muted)]">
        {job.next_run ? new Date(job.next_run).toLocaleString() : "—"}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--b70-text-muted)]">
        {job.last_run_at ? new Date(job.last_run_at).toLocaleString() : "—"}
      </td>
      <td className={`px-4 py-3 text-sm font-medium ${statusColor}`}>
        {job.last_status ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm text-rose-400 max-w-xs truncate" title={job.last_error ?? ""}>
        {job.last_error ? job.last_error : "—"}
      </td>
    </tr>
  );
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newsTriggering, setNewsTriggering] = useState(false);
  const [newsResult, setNewsResult] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    getStatus()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const onTriggerNews = async () => {
    setNewsTriggering(true);
    setNewsResult(null);
    try {
      const res = await triggerNewsScraper();
      setNewsResult(res.status === "ok" ? res.message : res.message);
      fetchStatus();
    } catch (e) {
      setNewsResult(e instanceof Error ? e.message : "Trigger failed");
    } finally {
      setNewsTriggering(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <h1 className="text-2xl font-bold text-slate-50">Service status</h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <h1 className="text-2xl font-bold text-slate-50">Service status</h1>
        <p className="text-rose-400">{error}</p>
        <Link href="/">
          <Button variant="outline">← Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-50">Service status</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-3 w-3 rounded-full ${data?.scheduler_running ? "bg-emerald-500" : "bg-rose-500"}`}
            aria-hidden
          />
          <span className="text-sm text-[var(--b70-text-muted)]">
            Scheduler {data?.scheduler_running ? "running" : "stopped"}
          </span>
          <Button
            variant="outline"
            disabled={newsTriggering}
            onClick={onTriggerNews}
          >
            {newsTriggering ? "Running…" : "Trigger news scraper"}
          </Button>
        </div>
      </div>

      {newsResult && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${newsResult.includes("completed") ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-rose-500/50 bg-rose-500/10 text-rose-300"}`}
        >
          {newsResult}
        </div>
      )}

      <Card>
        <CardHeader
          title="Background jobs"
          subtitle="Real-time status of scheduled services. Refreshes every 5 seconds."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--b70-border)] text-left text-sm text-[var(--b70-text-muted)]">
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Next run</th>
                <th className="px-4 py-3 font-medium">Last run</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {data?.jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-sm text-[var(--b70-text-muted)]">
        <p>
          Manual trigger: <code className="rounded bg-[var(--b70-border)] px-1">POST /bootstrap/news</code> or{" "}
          <code className="rounded bg-[var(--b70-border)] px-1">POST /api/v1/status/news/trigger</code>
        </p>
      </div>
    </div>
  );
}
