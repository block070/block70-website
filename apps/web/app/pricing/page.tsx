"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PlanCard } from "@/components/pricing/plan-card";
import { FeatureComparisonTable } from "@/components/pricing/feature-comparison-table";
import { PricingSocialProof } from "@/components/pricing/pricing-social-proof";
import { createCheckoutSession } from "@/lib/billing";
import { getToken } from "@/lib/auth";

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleUpgrade(plan: "pro" | "elite" | "quant") {
    if (!getToken()) {
      router.push("/register?next=/pricing");
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
    <div className="mx-auto max-w-6xl pb-20 pt-8">
      <header className="mb-10 border-b border-[var(--b70-border)] pb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--b70-crypto-blue)]">
          Pricing
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--b70-text)] md:text-4xl">
          One terminal. Four gears.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--b70-text-muted)]">
          Start free, upgrade when you need full Block70 Score depth, dense signals, and Quant-grade API
          access. All paid plans bill securely through Stripe — cancel any time from your account.
        </p>
        <p className="mt-2 text-xs text-[var(--b70-text-muted)] opacity-90">
          Not financial advice. Past performance does not guarantee future results.
        </p>
      </header>

      <div className="flex gap-6 overflow-x-auto pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0 xl:snap-none [&::-webkit-scrollbar]:hidden">
        <PlanCard
          className="min-w-[min(100%,280px)] shrink-0 snap-center sm:min-w-[300px] xl:min-w-0 xl:snap-align-none"
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
          onClick={() => router.push("/register?next=/pricing")}
        />
        <PlanCard
          className="min-w-[min(100%,280px)] shrink-0 snap-center sm:min-w-[300px] xl:min-w-0 xl:snap-align-none"
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
          emphasis="popular"
          ctaLabel={loadingPlan === "pro" ? "Redirecting..." : "Upgrade to Pro"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("pro")}
        />
        <PlanCard
          className="min-w-[min(100%,280px)] shrink-0 snap-center sm:min-w-[300px] xl:min-w-0 xl:snap-align-none"
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
          emphasis="best_value"
          ctaLabel={loadingPlan === "elite" ? "Redirecting..." : "Upgrade to Elite"}
          disabled={loadingPlan !== null}
          onClick={() => handleUpgrade("elite")}
        />
        <PlanCard
          className="min-w-[min(100%,280px)] shrink-0 snap-center sm:min-w-[300px] xl:min-w-0 xl:snap-align-none"
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

      <div className="mt-14 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--b70-text)]">Compare plans</h2>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Snapshot of what each tier unlocks in the product. Server-side checks enforce access.
        </p>
        <FeatureComparisonTable />
      </div>

      <div className="mt-14">
        <PricingSocialProof />
      </div>
    </div>
  );
}
