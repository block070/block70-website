"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature, hasPlanAccess } from "@/lib/plan-tier";
import { Button } from "@/components/ui/button";

type FeatureKey =
  | "opportunities_full"
  | "signals_medium"
  | "signals_high"
  | "ai_full"
  | "api_access";

type Props = {
  children: ReactNode;
  minPlan?: "pro" | "elite" | "quant";
  feature?: FeatureKey;
  title?: string;
  subtitle?: string;
};

export function PaywallSection({
  children,
  minPlan,
  feature,
  title = "Upgrade to unlock",
  subtitle = "This area is available on a higher plan.",
}: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        const tier = u.plan_type;
        let ok = true;
        if (minPlan) ok = ok && hasPlanAccess(tier, minPlan);
        if (feature) ok = ok && hasFeature(tier, feature);
        if (!cancelled) setAllowed(ok);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [minPlan, feature]);

  if (allowed === null) {
    return (
      <div className="h-32 animate-pulse rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]" />
    );
  }

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/35 bg-slate-950/40">
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/75 px-6 text-center">
        <Lock className="h-8 w-8 text-amber-300/90" aria-hidden />
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="max-w-sm text-xs text-slate-400">{subtitle}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/pricing">
            <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400">
              View plans
            </Button>
          </Link>
          <Link href="/store">
            <Button variant="outline">Marketplace</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
