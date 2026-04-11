"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getCurrentUser, getToken } from "@/lib/auth";
import { effectivePlanForGating, isPaidBlock70Plan } from "@/lib/plan-tier";
import { clsx } from "clsx";
import { gaEvent } from "@/lib/analytics/gtag";

/**
 * Fixed upgrade affordance for signed-in users still on a free-tier experience.
 */
export function StickyUpgradePill() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (cancelled) return;
        const eff = effectivePlanForGating(u.plan_type, u.trial_end);
        setVisible(!isPaidBlock70Plan(eff));
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={clsx(
        "pointer-events-none fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 justify-center px-4",
        "print:hidden",
      )}
    >
      <Link
        href="/pricing"
        onClick={() => gaEvent("upgrade_click", { location: "sticky_pill" })}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-950/95 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-lg shadow-amber-900/20 backdrop-blur hover:bg-amber-500/15"
      >
        <Sparkles className="h-4 w-4 text-amber-400" aria-hidden />
        Upgrade
      </Link>
    </div>
  );
}
