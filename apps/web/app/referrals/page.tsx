"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getReferralDashboard } from "@/lib/referrals-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/social/share-buttons";

export default function ReferralsPage() {
  const [data, setData] = useState<{
    referral_code: string;
    referral_link: string;
    referral_count: number;
    rewards_earned: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/register`
        : undefined;
    getReferralDashboard(baseUrl)
      .then(setData)
      .catch(() => setError("Unable to load referral data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Referrals</h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Referrals</h1>
        <p className="text-rose-400">{error || "Not found"}</p>
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
        <h1 className="text-2xl font-bold text-slate-50">Referral program</h1>
      </div>

      <Card>
        <CardHeader
          title="Your referral link"
          subtitle="Share with friends. You earn rewards when they sign up."
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-800 px-2 py-1.5 text-sm text-slate-200">
              {data.referral_link}
            </code>
            <ShareButtons
              url={data.referral_link}
              title="Join me on Block70 for alpha & signals"
              variant="compact"
            />
          </div>
          <p className="text-xs text-slate-500">
            Your code: <strong className="text-slate-400">{data.referral_code}</strong>
          </p>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">Referrals</p>
            <p className="text-2xl font-bold text-slate-100">
              {data.referral_count}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-slate-500">Rewards earned</p>
            <p className="text-2xl font-bold text-emerald-400">
              {data.rewards_earned.toFixed(1)} pts
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
