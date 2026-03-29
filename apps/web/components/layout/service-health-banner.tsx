"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type HealthOk = { ok: true; tried?: string; latencyMs?: number };

type HealthDown = {
  ok: false;
  reason?: string;
  message?: string;
  status?: number;
  detail?: string;
  tried?: string;
  latencyMs?: number;
  runbook?: {
    title: string;
    note?: string;
    docker: string;
    dockerRestart?: string;
    dockerLogs: string;
    uvicorn: string;
    statusPage: string;
    docs: string;
  };
};

type HealthPayload = HealthOk | HealthDown;

const POLL_OK_MS = 45_000;
const POLL_DOWN_MS = 12_000;

export function ServiceHealthBanner() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const backoffRef = useRef(0);

  const probe = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/health/services", { cache: "no-store" });
      const j = (await r.json()) as HealthPayload;
      setData(j);
      if (j.ok) {
        backoffRef.current = 0;
      } else {
        backoffRef.current = Math.min((backoffRef.current || 5_000) * 1.25, 60_000);
      }
    } catch {
      setData({
        ok: false,
        reason: "probe_failed",
        message: "Could not reach the site health check (this app may be misconfigured).",
      });
      backoffRef.current = Math.min((backoffRef.current || 5_000) * 1.25, 60_000);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    if (data === null) return;
    const ms = data.ok
      ? POLL_OK_MS
      : Math.max(POLL_DOWN_MS, backoffRef.current || POLL_DOWN_MS);
    const t = setTimeout(() => void probe(), ms);
    return () => clearTimeout(t);
  }, [data, probe]);

  if (data === null || data.ok === true) {
    return null;
  }

  const rb = "runbook" in data ? data.runbook : undefined;

  return (
    <div
      role="alert"
      className="border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 text-xs text-amber-100/95"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-amber-50">Backend API: </span>
          {data.message ?? "Unreachable or misconfigured."}
          {data.reason ? (
            <span className="ml-1 text-amber-200/80">({data.reason})</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void probe()}
            disabled={checking}
            className="rounded-md border border-amber-400/40 bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-50 hover:bg-amber-950/70 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Retry now"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-md border border-amber-400/30 px-2.5 py-1 text-[11px] text-amber-100/90 hover:bg-amber-950/30"
          >
            {expanded ? "Hide" : "Show"} how to fix
          </button>
          <Link
            href="/status"
            className="text-[11px] font-medium text-amber-200 underline decoration-amber-400/50 hover:text-amber-50"
          >
            System status
          </Link>
        </div>
      </div>
      {expanded && rb ? (
        <div className="mx-auto mt-2 max-w-6xl rounded-md border border-amber-500/25 bg-[var(--b70-bg)]/80 p-3 font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed text-[var(--b70-text-muted)]">
          <p className="mb-2 font-medium text-[var(--b70-text)]">{rb.title}</p>
          {rb.note ? <p className="mb-2 text-[var(--b70-text)]/90">{rb.note}</p> : null}
          <ul className="list-inside list-disc space-y-1">
            {rb.dockerRestart ? (
              <li>
                <span className="text-[var(--b70-text)]/80">Restart: </span>
                <code className="rounded bg-[var(--b70-card)] px-1 text-[var(--b70-text)]">
                  {rb.dockerRestart}
                </code>
              </li>
            ) : null}
            <li>
              <code className="rounded bg-[var(--b70-card)] px-1 text-[var(--b70-text)]">{rb.docker}</code>
            </li>
            <li>
              <code className="rounded bg-[var(--b70-card)] px-1 text-[var(--b70-text)]">{rb.dockerLogs}</code>
            </li>
            <li>
              <code className="rounded bg-[var(--b70-card)] px-1 text-[var(--b70-text)]">{rb.uvicorn}</code>
            </li>
          </ul>
          <p className="mt-2">
            Scheduler / jobs:{" "}
            <Link href={rb.statusPage} className="text-[var(--b70-crypto-blue)] hover:underline">
              {rb.statusPage}
            </Link>
            . {rb.docs}
          </p>
        </div>
      ) : null}
    </div>
  );
}
