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
        Choose the plan that matches your operation. Upgrade or downgrade
        anytime.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        <PlanCard
          name="Free"
          price="$0"
          description="Explore the Block70 opportunity feed."
          features={[
            "Basic opportunity feed",
            "Dashboard overview",
            "Airdrops & narratives",
          ]}
          ctaLabel="Get started"
          onClick={() => router.push("/register")}
        />
        <PlanCard
          name="Pro"
          price="$49/mo"
          description="For active operators running multiple plays."
          features={[
            "Everything in Free",
            "Advanced filters",
            "Strategy builder",
            "Priority opportunity insights",
          ]}
          highlighted
          ctaLabel={loadingPlan === "pro" ? "Redirecting..." : "Upgrade to Pro"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("pro")}
        />
        <PlanCard
          name="Elite"
          price="$149/mo"
          description="For desks that need real-time, AI-assisted alpha."
          features={[
            "Everything in Pro",
            "Real-time premium alerts",
            "AI research reports",
            "Alpha radar & liquidity stream",
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
        <h2 className="text-lg font-semibold">{name}</h2>
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

