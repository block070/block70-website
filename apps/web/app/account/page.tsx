"use client";

import { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { createBillingPortalSession, getSubscription } from "@/lib/billing";
import { SubscriptionStatus } from "@/components/account/subscription-status";

type User = {
  email: string;
  plan_type: "free" | "pro" | "elite";
};

type Subscription = {
  plan_type: "free" | "pro" | "elite";
  status: string;
  current_period_end?: string | null;
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [u, sub] = await Promise.all([getCurrentUser(), getSubscription()]);
        setUser({ email: u.email, plan_type: u.plan_type });
        setSubscription({
          plan_type: sub.plan_type,
          status: sub.status,
          current_period_end: sub.current_period_end as string | null,
        });
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-400">
        Loading account…
      </div>
    );
  }

  if (!user || !subscription) {
    return (
      <div className="mx-auto max-w-xl py-16 text-sm text-slate-400">
        You need to be signed in to view your account.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-16 space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Account settings
        </h1>
        <p className="text-sm text-slate-400">
          Manage your subscription and security for Block70.
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <p>
          <span className="font-medium text-slate-300">Email:</span>{" "}
          <span className="text-slate-100">{user.email}</span>
        </p>
        <p>
          <span className="font-medium text-slate-300">Plan:</span>{" "}
          <span className="capitalize text-slate-100">
            {subscription.plan_type}
          </span>
        </p>
      </div>

      <SubscriptionStatus
        planType={subscription.plan_type}
        status={subscription.status}
        nextBillingDate={subscription.current_period_end ?? undefined}
      />

      <div className="space-y-3 text-xs">
        <button
          className="rounded-md bg-slate-900 px-3 py-2 font-medium text-slate-100 hover:bg-slate-800"
          onClick={() => createBillingPortalSession()}
        >
          Open billing portal
        </button>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs">
        <p className="font-medium text-slate-200">Change password</p>
        <p className="text-slate-400">
          Password changes are coming soon. For now, contact support to update
          your credentials.
        </p>
      </div>
    </div>
  );
}

