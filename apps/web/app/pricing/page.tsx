"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlanCard } from "@/components/pricing/plan-card";
import { createCheckoutSession } from "@/lib/billing";
import { getToken } from "@/lib/auth";

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleUpgrade(plan: "pro" | "elite" | "quant") {
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
    <div className="mx-auto max-w-6xl py-16">
      <h1 className="mb-4 text-3xl font-semibold tracking-tight">Pricing</h1>
      <p className="mb-10 text-sm text-slate-400">
        Free for discovery; Pro, Elite, and Quant add real-time data, full AI quotas,
        deeper signals, and programmatic API access on Quant.
      </p>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <PlanCard
          name="Free"
          badge="Traffic engine"
          price="$0"
          description="Onboard and explore — ideal for search and acquisition."
          features={[
            "Basic coin and market data",
            "Limited / delayed Block70 score on select surfaces",
            "AI search: 5 questions / day",
            "Delayed signals & shallow opportunity lists",
          ]}
          ctaLabel="Get started"
          onClick={() => router.push("/register")}
        />
        <PlanCard
          name="Pro"
          badge="Growth"
          price="$29/mo"
          description="For operators who act on signals, not just headlines."
          features={[
            "Near-real-time feeds & richer opportunities",
            "Charts and category insights",
            "AI search: 50 questions / day",
            "Alert-ready scoring surfaces",
          ]}
          highlighted
          ctaLabel={loadingPlan === "pro" ? "Redirecting..." : "Upgrade to Pro"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("pro")}
        />
        <PlanCard
          name="Elite"
          badge="Desk"
          price="$99/mo"
          description="Deeper edge, whale-style context, and full opportunity intel."
          features={[
            "Everything in Pro",
            "Full opportunities & smart-wallet directory depth",
            "Real-time, high-density signals",
            "Unlimited AI (fair use)",
          ]}
          ctaLabel={loadingPlan === "elite" ? "Redirecting..." : "Upgrade to Elite"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("elite")}
        />
        <PlanCard
          name="Quant"
          badge="API & automation"
          price="$299/mo"
          description="Institutional-style access: REST API keys and highest limits."
          features={[
            "Everything in Elite",
            "Developer API keys & usage dashboard",
            "Highest rate limits for automation",
            "Priority for data-heavy workflows",
          ]}
          ctaLabel={loadingPlan === "quant" ? "Redirecting..." : "Upgrade to Quant"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("quant")}
        />
      </div>
    </div>
  );
}
