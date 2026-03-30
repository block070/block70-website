"use client";

import Link from "next/link";
import { subDays } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Wrench,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getPlatformStatus,
  type ComponentStatus,
  type PlatformStatusResponse,
} from "@/lib/platform-status-api";
import { STATUS_INCIDENTS, type StatusIncident } from "@/lib/service-status-incidents";
import {
  getStatus,
  triggerAllCoinsUpdate,
  triggerNewsScraper,
  type JobStatus,
  type StatusResponse,
} from "@/lib/status-api";

const PLATFORM_POLL_MS = 30_000;
const JOBS_POLL_MS = 12_000;

function statusPillClass(s: ComponentStatus): string {
  if (s === "operational") return "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-400";
  if (s === "degraded") return "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/35 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/30 dark:text-rose-400";
}

function StatusIcon({ status }: { status: ComponentStatus }) {
  if (status === "operational") return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />;
  if (status === "degraded") return <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />;
  return <XCircle className="h-5 w-5 text-rose-500" aria-hidden />;
}

function severityRank(s: StatusIncident["severity"]): number {
  if (s === "critical") return 3;
  if (s === "major") return 2;
  return 1;
}

function dayIncidentSeverity(dayIndex: number, incidents: StatusIncident[]): ComponentStatus | "ok" {
  const day = subDays(new Date(), dayIndex);
  const start = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0, 0);
  const end = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59, 999);
  let worst = 0;
  for (const inc of incidents) {
    const is = new Date(inc.startedAt).getTime();
    const ie = inc.resolvedAt ? new Date(inc.resolvedAt).getTime() : Date.now();
    if (ie < start || is > end) continue;
    worst = Math.max(worst, severityRank(inc.severity));
  }
  if (worst >= 3) return "outage";
  if (worst >= 2) return "outage";
  if (worst >= 1) return "degraded";
  return "ok";
}

function barClass(daySeverity: ComponentStatus | "ok"): string {
  if (daySeverity === "ok") return "bg-emerald-500/80 hover:bg-emerald-400";
  if (daySeverity === "degraded") return "bg-amber-500/85 hover:bg-amber-400";
  return "bg-rose-500/85 hover:bg-rose-400";
}

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
      <td className={`px-4 py-3 text-sm font-medium ${statusColor}`}>{job.last_status ?? "—"}</td>
      <td
        className="max-w-xs truncate px-4 py-3 text-sm text-rose-400"
        title={job.last_error ?? ""}
      >
        {job.last_error ? job.last_error : "—"}
      </td>
    </tr>
  );
}

export default function ServiceStatusPage() {
  const [platform, setPlatform] = useState<PlatformStatusResponse | null>(null);
  const [platformErr, setPlatformErr] = useState<string | null>(null);
  const [jobs, setJobs] = useState<StatusResponse | null>(null);
  const [jobsErr, setJobsErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [newsTriggering, setNewsTriggering] = useState(false);
  const [newsResult, setNewsResult] = useState<string | null>(null);
  const [coinsTriggering, setCoinsTriggering] = useState(false);
  const [coinsResult, setCoinsResult] = useState<string | null>(null);

  const fetchPlatform = useCallback(() => {
    setPlatformErr(null);
    getPlatformStatus()
      .then(setPlatform)
      .catch((e) => setPlatformErr(e instanceof Error ? e.message : "Failed to load status"));
  }, []);

  const fetchJobs = useCallback(() => {
    setJobsErr(null);
    getStatus()
      .then(setJobs)
      .catch((e) => setJobsErr(e instanceof Error ? e.message : "Failed to load jobs"));
  }, []);

  useEffect(() => {
    setLoading(true);
    setPlatformErr(null);
    setJobsErr(null);
    getPlatformStatus()
      .then(setPlatform)
      .catch((e) =>
        setPlatformErr(e instanceof Error ? e.message : "Failed to load platform status"),
      )
      .finally(() => setLoading(false));
    getStatus()
      .then(setJobs)
      .catch((e) => setJobsErr(e instanceof Error ? e.message : "Failed to load jobs"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  useEffect(() => {
    const a = setInterval(fetchPlatform, PLATFORM_POLL_MS);
    return () => clearInterval(a);
  }, [fetchPlatform]);

  useEffect(() => {
    const b = setInterval(fetchJobs, JOBS_POLL_MS);
    return () => clearInterval(b);
  }, [fetchJobs]);

  const uptimeDays = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => ({
      index: i,
      severity: dayIncidentSeverity(i, STATUS_INCIDENTS),
    })).reverse();
  }, []);

  const sortedIncidents = useMemo(() => {
    return [...STATUS_INCIDENTS].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, []);

  const onTriggerNews = async () => {
    setNewsTriggering(true);
    setNewsResult(null);
    try {
      const res = await triggerNewsScraper();
      setNewsResult(res.status === "ok" ? res.message : res.message);
      fetchJobs();
    } catch (e) {
      setNewsResult(e instanceof Error ? e.message : "Trigger failed");
    } finally {
      setNewsTriggering(false);
    }
  };

  const onTriggerAllCoins = async () => {
    setCoinsTriggering(true);
    setCoinsResult(null);
    try {
      const res = await triggerAllCoinsUpdate();
      setCoinsResult(res.status === "ok" ? res.message : res.message);
      fetchJobs();
    } catch (e) {
      setCoinsResult(e instanceof Error ? e.message : "Trigger failed");
    } finally {
      setCoinsTriggering(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
              Reliability
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--b70-text)]">
              System status
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[var(--b70-text-muted)]">
              Live checks for core Block70 systems. Historical bars reflect published incidents only;
              automated per-minute uptime history may be added later.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              void fetchPlatform();
              void fetchJobs();
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
        </div>

        {loading && !platform ? (
          <div className="h-14 animate-pulse rounded-lg bg-[var(--b70-border)]" />
        ) : platform ? (
          <div
            className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${statusPillClass(platform.overall)} border-transparent bg-[var(--b70-card)]`}
          >
            <Activity className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium capitalize">{platform.overall.replace(/_/g, " ")}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs opacity-90">
                <Clock className="inline h-3.5 w-3.5" aria-hidden />
                Last checked{" "}
                {new Date(platform.checked_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
              </p>
            </div>
          </div>
        ) : platformErr ? (
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {platformErr}
          </div>
        ) : null}
      </header>

      <section aria-labelledby="components-heading">
        <h2 id="components-heading" className="sr-only">
          Component status
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(["api", "signals", "ai"] as const).map((key) => {
            const c = platform?.components[key];
            if (!c) {
              if (platformErr) {
                return (
                  <Card key={key} className="hover:!translate-y-0 hover:!shadow-none">
                    <div className="p-5 text-sm text-rose-400">Status unavailable for this component.</div>
                  </Card>
                );
              }
              return (
                <Card key={key} className="hover:!translate-y-0 hover:!shadow-none">
                  <div className="p-5">
                    <div className="h-24 animate-pulse rounded bg-[var(--b70-border)]" />
                  </div>
                </Card>
              );
            }
            return (
              <Card key={key} className="hover:!translate-y-0 hover:!shadow-none">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
                        {key === "api" ? "API" : key === "signals" ? "Signals" : "AI"}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--b70-text)]">{c.name}</h3>
                    </div>
                    <StatusIcon status={c.status} />
                  </div>
                  <span
                    className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusPillClass(c.status)}`}
                  >
                    {c.status}
                  </span>
                  {typeof c.latency_ms === "number" ? (
                    <p className="mt-2 font-mono text-xs text-[var(--b70-text-muted)]">
                      DB ping {c.latency_ms} ms
                    </p>
                  ) : null}
                  {c.detail ? (
                    <p className="mt-2 text-sm text-[var(--b70-text-muted)]">{c.detail}</p>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--b70-text-muted)]">
                      No issues detected for this component.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <Card className="hover:!translate-y-0 hover:!shadow-none">
          <CardHeader
            title="Uptime history"
            subtitle="Last 90 days (UTC), based on incidents listed below. Green = no published incident overlap."
          />
          <div className="px-4 pb-4">
            <div
              className="flex h-10 w-full gap-px overflow-hidden rounded-md bg-[var(--b70-border)] p-px"
              role="img"
              aria-label="Ninety day uptime strip, green for normal days"
            >
              {uptimeDays.map(({ index, severity }) => (
                <div
                  key={index}
                  className={`min-w-0 flex-1 rounded-sm transition-colors ${barClass(severity)}`}
                  title={`${severity === "ok" ? "Normal" : severity} — day ${90 - index} ago (UTC)`}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--b70-text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-emerald-500/80" /> Normal
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-amber-500/85" /> Minor / maintenance
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-sm bg-rose-500/85" /> Major or critical
              </span>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <Card className="hover:!translate-y-0 hover:!shadow-none">
          <CardHeader
            title="Incident reports"
            subtitle="What happened, affected systems, and resolution. Subscribe to updates via your account notifications when available."
          />
          <div className="space-y-4 p-4">
            {sortedIncidents.length === 0 ? (
              <p className="text-sm text-[var(--b70-text-muted)]">
                No incidents published. When we post an event, it will appear here with timestamps and
                resolution notes.
              </p>
            ) : (
              sortedIncidents.map((inc) => (
                <article
                  key={inc.id}
                  className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-[var(--b70-text)]">{inc.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusPillClass(inc.severity === "minor" ? "degraded" : "outage")}`}
                    >
                      {inc.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                    {new Date(inc.startedAt).toLocaleString()}
                    {inc.resolvedAt
                      ? ` → resolved ${new Date(inc.resolvedAt).toLocaleString()}`
                      : " → ongoing"}
                  </p>
                  <p className="mt-2 text-sm text-[var(--b70-text)]">{inc.summary}</p>
                  <p className="mt-2 text-xs text-[var(--b70-text-muted)]">
                    Affected:{" "}
                    {inc.affected.length ? inc.affected.join(", ") : "—"}
                  </p>
                  {inc.updates.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-t border-[var(--b70-border)] pt-3 text-sm">
                      {[...inc.updates]
                        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                        .map((u, i) => (
                          <li key={i} className="text-[var(--b70-text-muted)]">
                            <span className="font-mono text-xs text-[var(--b70-text)]">
                              {new Date(u.at).toLocaleString()}
                            </span>
                            {" — "}
                            {u.message}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-card)]/40">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-[var(--b70-text)]"
          onClick={() => setOperatorOpen((o) => !o)}
          aria-expanded={operatorOpen}
        >
          <span className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[var(--b70-text-muted)]" aria-hidden />
            Operator tools
            <span className="font-normal text-[var(--b70-text-muted)]">
              — background jobs &amp; manual triggers
            </span>
          </span>
          {operatorOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </button>
        {operatorOpen ? (
          <div className="space-y-4 border-t border-[var(--b70-border)] px-4 pb-4 pt-3">
            <p className="text-xs text-amber-600 dark:text-amber-400/90">
              These actions hit admin-only proxies. Use only when you understand blast radius (rate limits,
              upstream APIs, and database load).
            </p>
            {jobsErr ? (
              <p className="text-sm text-rose-400">{jobsErr}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={newsTriggering} onClick={onTriggerNews}>
                {newsTriggering ? "Running…" : "Trigger news scraper"}
              </Button>
              <Button variant="outline" size="sm" disabled={coinsTriggering} onClick={onTriggerAllCoins}>
                {coinsTriggering ? "Running…" : "Update all coins job"}
              </Button>
            </div>
            {newsResult ? (
              <p className="text-xs text-[var(--b70-text-muted)]">{newsResult}</p>
            ) : null}
            {coinsResult ? (
              <p className="text-xs text-[var(--b70-text-muted)]">{coinsResult}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-[var(--b70-border)]">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--b70-border)] text-[var(--b70-text-muted)]">
                    <th className="px-4 py-2 font-medium">Service</th>
                    <th className="px-4 py-2 font-medium">Next run</th>
                    <th className="px-4 py-2 font-medium">Last run</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs?.jobs?.length ? (
                    jobs.jobs.map((job) => <JobRow key={job.id} job={job} />)
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-[var(--b70-text-muted)]">
                        {jobs ? "No scheduler jobs reported." : "Loading…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--b70-text-muted)]">
              <span>
                Scheduler: {jobs?.scheduler_running ? "running" : "stopped or unreachable"}
              </span>
              <Link href="/developers" className="text-blue-600 hover:underline dark:text-blue-400">
                API keys
              </Link>
              <Link href="/apidocs" className="text-blue-600 hover:underline dark:text-blue-400">
                API docs
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
