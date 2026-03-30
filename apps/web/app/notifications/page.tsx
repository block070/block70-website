"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listNotifications,
  markNotificationRead,
  type UserNotificationDto,
} from "@/lib/notifications-api";
import { getCurrentUser } from "@/lib/auth";
import { effectivePlanForGating, isPaidBlock70Plan } from "@/lib/plan-tier";
import { OpenPricingModalButton } from "@/components/pricing/open-pricing-modal-button";

function shouldShowUpgradeCta(
  plan: string,
  t: string,
): { show: boolean; plan: "pro" | "elite" | "quant" } {
  const paid = isPaidBlock70Plan(plan);
  if (paid) return { show: false, plan: "elite" };
  if (t.includes("trial")) return { show: true, plan: "elite" };
  if (t.includes("signal") || t === "new_signal") return { show: true, plan: "pro" };
  if (t.includes("narrative")) return { show: true, plan: "elite" };
  if (t.includes("inactive")) return { show: true, plan: "pro" };
  return { show: true, plan: "elite" };
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<UserNotificationDto[]>([]);
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const list = await listNotifications(80, 0);
      setRows(list);
    } catch {
      setErr("Sign in to view notifications.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void getCurrentUser()
      .then((u) => {
        const eff = effectivePlanForGating(u.plan_type, u.trial_end ?? null);
        setPlan(eff);
        return load();
      })
      .catch(() => {
        setLoading(false);
        setErr("Sign in to view notifications.");
      });
  }, [load]);

  async function markRead(id: number) {
    try {
      await markNotificationRead(id);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, read_at: new Date().toISOString() } : r,
        ),
      );
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
        Notifications
      </h1>
      <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
        In-app alerts from Block70. Email delivery follows your account settings.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--b70-text-muted)]">Loading…</p>
      ) : err ? (
        <p className="mt-8 text-sm text-rose-400">{err}</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--b70-text-muted)]">
          No notifications yet. Signals and narrative updates will appear here.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((n) => {
            const unread = !n.read_at;
            const { show, plan: hintPlan } = shouldShowUpgradeCta(plan, n.notification_type);
            return (
              <li
                key={n.id}
                className={`rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 text-sm ${
                  unread ? "ring-1 ring-[var(--b70-crypto-blue)]/25" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-crypto-blue)]">
                    {n.notification_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-[var(--b70-text-muted)]">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </span>
                </div>
                <p className="mt-2 text-[var(--b70-text)]">{n.content}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unread ? (
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--b70-border)] px-2 py-1 text-[11px] text-[var(--b70-text-muted)] hover:bg-[var(--b70-bg)]"
                      onClick={() => void markRead(n.id)}
                    >
                      Mark read
                    </button>
                  ) : null}
                  {show ? (
                    <OpenPricingModalButton
                      plan={hintPlan}
                      className="text-[11px] font-medium text-amber-400 hover:text-amber-300"
                    >
                      Upgrade for full desk access
                    </OpenPricingModalButton>
                  ) : null}
                  <Link
                    href="/account"
                    className="text-[11px] text-[var(--b70-text-muted)] hover:underline"
                  >
                    Email settings
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
