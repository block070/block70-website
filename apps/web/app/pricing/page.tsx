"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

type PlanCardProps = {
  name: string;
  badge?: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel: string;
  disabled?: boolean;
  onClick: () => void;
};

function PlanCard({
  name,
  badge,
  price,
  description,
  features,
  highlighted,
  ctaLabel,
  disabled,
  onClick,
}: PlanCardProps) {
  return (
    <div
      className={`flex flex-col justify-between rounded-xl border p-5 ${
        highlighted
          ? "border-emerald-500/60 bg-emerald-500/5 shadow-lg shadow-emerald-500/20"
          : "border-slate-800 bg-slate-950/40"
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{name}</h2>
          {badge ? (
            <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-bold">{price}</p>
        <p className="text-xs text-slate-400">{description}</p>
        <ul className="mt-4 space-y-1 text-xs text-slate-300">
          {features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
      </div>
      <button
        className="mt-6 w-full rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        onClick={onClick}
        disabled={disabled}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
