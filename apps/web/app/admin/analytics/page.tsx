"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGrowthAnalytics } from "@/lib/admin-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<{
    total_users: number;
    new_users_7d: number;
    new_users_30d: number;
    dau: number;
    notifications_7d: number;
    referrals_7d: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGrowthAnalytics()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Forbidden"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Growth analytics</h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Growth analytics</h1>
        <p className="text-rose-400">{error || "Unable to load"}</p>
        <p className="text-sm text-slate-500">Admin access required.</p>
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Growth dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">Total users</p>
            <p className="text-2xl font-bold text-slate-100">
              {data.total_users}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">New users (7d)</p>
            <p className="text-2xl font-bold text-emerald-400">
              {data.new_users_7d}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">New users (30d)</p>
            <p className="text-2xl font-bold text-slate-100">
              {data.new_users_30d}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">DAU (today)</p>
            <p className="text-2xl font-bold text-slate-100">{data.dau}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">Notifications sent (7d)</p>
            <p className="text-2xl font-bold text-slate-100">
              {data.notifications_7d}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">Referrals (7d)</p>
            <p className="text-2xl font-bold text-slate-100">
              {data.referrals_7d}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
