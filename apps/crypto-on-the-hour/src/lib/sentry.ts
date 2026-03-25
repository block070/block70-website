/**
 * Optional observability — set SENTRY_DSN on API and worker processes.
 */
import * as Sentry from "@sentry/node";

export function initSentry(service: "api" | "worker"): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.05,
    initialScope: { tags: { service: `crypto-on-the-hour-${service}` } },
  });
}

export function captureWorkerError(err: unknown, extra?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN?.trim()) return;
  Sentry.captureException(err, { extra });
}
