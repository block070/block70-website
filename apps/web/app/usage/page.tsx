"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/lib/billing";
import { getToken } from "@/lib/auth";
import {
  getUsageSummary,
  type UsageSummaryResponse,
} from "@/lib/usage-summary";

function formatPeriodRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function LimitRow({
  label,
  used,
  lim,
}: {
  label: string;
  used: number;
  lim: { limit: number | null; remaining: number | null; unlimited: boolean };
}) {
  if (lim.unlimited) {
    return (
      <div className="flex justify-between gap-4 text-sm">
        <span className="text-[var(--b70-text-muted)]">{label}</span>
        <span className="tabular-nums text-[var(--b70-text)]">
          {used.toLocaleString()} used{" "}
          <span className="text-emerald-600 dark:text-emerald-400">· Unlimited</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-[var(--b70-text-muted)]">{label}</span>
      <span className="tabular-nums text-[var(--b70-text)]">
        {used.toLocaleString()} used{" "}
        <span className="text-[var(--b70-text-muted)]">
          · {lim.remaining?.toLocaleString() ?? 0} left of {lim.limit?.toLocaleString() ?? "—"}
        </span>
      </span>
    </div>
  );
}

export default function UsagePage() {
  const [data, setData] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    getUsageSummary()
      .then(setData)
      .catch(() => setErr("Failed to load usage."))
      .finally(() => setLoading(false));
  }, []);

  const authed = Boolean(getToken());

  if (!authed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-sm text-[var(--b70-text-muted)]">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          Billing &amp; usage
        </h1>
        <p className="mb-6">Sign in to see API usage, quotas, and estimated billing.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-[var(--b70-border)] px-4 py-2 text-sm font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="h-40 animate-pulse rounded-lg bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-sm text-rose-400">
        {err ?? "Something went wrong."}
      </div>
    );
  }

  const upgrade = data.actions.upgrade_plan;
  const premiumCap = data.quotas.premium_api_limit_24h;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
            Billing &amp; usage
          </h1>
          <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
            Current period: {formatPeriodRange(data.period.start, data.period.end)}
          </p>
          <p className="mt-2 text-xs text-[var(--b70-text-muted)]">
            <span className="capitalize">{data.plan.type}</span> plan
            {data.plan.status !== "none" ? ` · ${data.plan.status}` : null}
            {data.plan.current_period_end
              ? ` · Renews ${new Date(data.plan.current_period_end).toLocaleDateString()}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/account">
            <Button variant="outline" className="text-xs">
              Account settings
            </Button>
          </Link>
          <Link href="/developers/analytics">
            <Button variant="outline" className="text-xs">
              Developer API charts
            </Button>
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
          Usage
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <div className="p-4">
              <p className="text-xs font-medium text-[var(--b70-text-muted)]">API calls</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
                {data.metrics.api_calls.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
                Developer API (this period)
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-xs font-medium text-[var(--b70-text-muted)]">Signals used</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
                {data.metrics.signals_used.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
                Authenticated feed requests
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-xs font-medium text-[var(--b70-text-muted)]">AI queries</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
                {data.metrics.ai_queries.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
                Logged searches (this period)
              </p>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
          Limits &amp; quota
        </h2>
        <Card>
          <CardHeader
            title="Plan limits"
            subtitle="Monthly display caps; enforcement may differ by endpoint."
          />
          <div className="space-y-3 p-4">
            <LimitRow label="AI queries (billing period)" used={data.metrics.ai_queries} lim={data.limits_display.ai} />
            {data.limits_display.ai_daily ? (
              <LimitRow
                label="AI queries (last 24h)"
                used={data.metrics.ai_queries_24h ?? 0}
                lim={data.limits_display.ai_daily}
              />
            ) : null}
            <LimitRow
              label="Signals (period)"
              used={data.metrics.signals_used}
              lim={data.limits_display.signals}
            />
            <div className="border-t border-[var(--b70-border)] pt-3">
              <p className="mb-2 text-xs font-medium text-[var(--b70-text-muted)]">
                Premium feature calls (rolling 24h)
              </p>
              <p className="text-sm tabular-nums text-[var(--b70-text)]">
                {data.quotas.premium_api_calls_24h.toLocaleString()}
                {premiumCap == null ? (
                  <span className="ml-2 text-emerald-600 dark:text-emerald-400">· Unlimited</span>
                ) : (
                  <span className="text-[var(--b70-text-muted)]">
                    {" "}
                    / {premiumCap.toLocaleString()} / 24h (alerts &amp; strategies)
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="mt-4">
          <CardHeader
            title="API keys (today, UTC)"
            subtitle="Per-key developer API daily limits"
          />
          <div className="overflow-x-auto p-4">
            {data.quotas.developer_keys.length === 0 ? (
              <p className="text-sm text-[var(--b70-text-muted)]">
                No API keys yet.{" "}
                <Link href="/developers" className="text-blue-600 hover:underline dark:text-blue-400">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--b70-border)] text-[11px] uppercase text-[var(--b70-text-muted)]">
                    <th className="py-2 pr-4 font-medium">Key</th>
                    <th className="py-2 pr-4 font-medium">Plan</th>
                    <th className="py-2 pr-4 text-right font-medium">Used today</th>
                    <th className="py-2 text-right font-medium">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quotas.developer_keys.map((k) => (
                    <tr key={k.api_key_id} className="border-b border-[var(--b70-border)]/60">
                      <td className="py-2 pr-4 font-mono text-xs text-[var(--b70-text)]">
                        {k.key_label || k.key_prefix}…
                      </td>
                      <td className="py-2 pr-4 capitalize text-[var(--b70-text-muted)]">
                        {k.plan_type}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-[var(--b70-text)]">
                        {k.usage_today.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums text-[var(--b70-text)]">
                        {k.unlimited ? "∞" : (k.remaining_today ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
          Billing
        </h2>
        <Card>
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--b70-text-muted)]">Estimated monthly</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
                {data.billing.currency === "USD" ? "$" : `${data.billing.currency} `}
                {data.billing.estimated_monthly_usd.toLocaleString()}
                <span className="ml-1 text-base font-normal text-[var(--b70-text-muted)]">/ mo</span>
              </p>
              <p className="mt-1 text-xs text-[var(--b70-text-muted)]">{data.billing.note}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              {upgrade ? (
                <Button
                  className="w-full sm:w-auto"
                  disabled={checkoutLoading !== null}
                  onClick={() => {
                    setCheckoutLoading(upgrade);
                    createCheckoutSession(upgrade).catch(() =>
                      setCheckoutLoading(null),
                    );
                  }}
                >
                  {checkoutLoading === upgrade
                    ? "Redirecting…"
                    : upgrade === "pro"
                      ? "Upgrade to Pro"
                      : upgrade === "elite"
                        ? "Upgrade to Elite"
                        : "Upgrade to Quant"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => createBillingPortalSession()}
              >
                Open billing portal
              </Button>
              <Link
                href={data.actions.pricing_path}
                className="text-center text-xs text-blue-600 hover:underline dark:text-blue-400 sm:text-right"
              >
                Compare plans
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
