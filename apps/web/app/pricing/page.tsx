"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlanCard } from "@/components/pricing/plan-card";
import { createCheckoutSession } from "@/lib/billing";
import { getToken } from "@/lib/auth";

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleUpgrade(plan: "pro" | "elite") {
    if (!getToken()) {
      router.push("/register");
      return;
    }
    setLoadingPlan(plan);
    try {
      await createCheckoutSession(plan);
    } catch (err) {
      console.error(err);
      setLoadingPlan(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-16">
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Pricing</h1>
      <p className="mb-10 text-sm text-slate-400">
        Free for discovery and SEO; Pro and Elite add real-time Block70 scoring, full chart
        indicators, and actionable alerts when the market moves.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        <PlanCard
          name="Free"
          badge="Traffic engine"
          price="$0"
          description="Onboard and explore — ideal for search and acquisition."
          features={[
            "Basic coin and market data",
            "Limited / delayed Block70 score on select surfaces",
            "AI search (rate-limited)",
            "No price or score alerts",
          ]}
          ctaLabel="Get started"
          onClick={() => router.push("/register")}
        />
        <PlanCard
          name="Pro"
          badge="Main revenue tier"
          price="$19/mo"
          description="For operators who act on signals, not just headlines."
          features={[
            "Real-time Block70 score + Buy / Sell / Hold labels",
            "Full charts with RSI, MACD, SMAs, volume trend & momentum readouts",
            "Trending and category insights",
            "Alerts: score crosses 80 (Strong Buy) or below 40 (Sell), volume spike, momentum spike (email + Telegram where configured)",
          ]}
          highlighted
          ctaLabel={loadingPlan === "pro" ? "Redirecting..." : "Upgrade to Pro"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("pro")}
        />
        <PlanCard
          name="Elite"
          badge="Desk tier"
          price="$49/mo"
          description="Everything in Pro plus deeper edge and customization."
          features={[
            "Everything in Pro",
            "Whale-tracking style signals (where data is available)",
            "Early trend detection helpers and “top opportunities” style feeds",
            "Portfolio tracking hooks",
            "Custom alert routing and higher-frequency checks (per environment)",
          ]}
          ctaLabel={loadingPlan === "elite" ? "Redirecting..." : "Upgrade to Elite"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("elite")}
        />
      </div>
    </div>
  );
}
