"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PlanCard } from "@/components/pricing/plan-card";
import {
  createUplandCheckoutSession,
  openUplandBillingPortal,
} from "@/lib/upland-billing";
import { getToken } from "@/lib/auth";

const UPSELL_COPY: Record<string, { title: string; body: string }> = {
  upland_deal_score: {
    title: "Unlock Deal Score",
    body: "Pro users see a 0–100 Deal Score on every property plus hidden-gem filters.",
  },
  upland_vehicle_filter: {
    title: "Unlock the Vehicle filter",
    body: "Filter and sort by properties that include vehicle NFTs — Pro only.",
  },
  upland_hidden_gems_feed: {
    title: "See the Hidden Gems feed",
    body: "Properties with a vehicle, low markup, and strong yield. Pro tier only.",
  },
  upland_advanced_filters: {
    title: "Unlock advanced filters",
    body: "Neighborhood search, yield ranges, markup filters, and deal sorting.",
  },
  upland_realtime_alerts: {
    title: "Real-time alerts — Elite",
    body: "Email or webhook alerts when your saved filters match a new listing.",
  },
  upland_api_access: {
    title: "Upland API access — Elite",
    body: "Programmatic JSON access to properties, cities, and deal scores.",
  },
};

function PricingInner() {
  const router = useRouter();
  const search = useSearchParams();
  const upsell = search.get("upsell");
  const checkout = search.get("checkout");
  const [loadingTier, setLoadingTier] = useState<null | "pro" | "elite" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(tier: "pro" | "elite") {
    setError(null);
    if (!getToken()) {
      router.push(`/register?next=${encodeURIComponent(`/coins/upland/pricing?plan=${tier}`)}`);
      return;
    }
    setLoadingTier(tier);
    try {
      await createUplandCheckoutSession(tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setLoadingTier(null);
    }
  }

  async function handlePortal() {
    setError(null);
    setLoadingTier("portal");
    try {
      await openUplandBillingPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open portal");
      setLoadingTier(null);
    }
  }

  const upsellCopy = upsell ? UPSELL_COPY[upsell] : null;

  return (
    <div className="mx-auto max-w-6xl pb-20 pt-8">
      <header className="mb-10 border-b border-[var(--b70-border)] pb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--b70-crypto-blue)]">
          Upland Property Search
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--b70-text)] md:text-4xl">
          Stop guessing. Start scoring.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--b70-text-muted)]">
          Block70&apos;s Upland Property Search goes beyond listings — Pro and Elite tiers add the Deal Score,
          vehicle detection, hidden-gem alerts, and real-time streams so you can act on opportunities before
          they&apos;re gone.
        </p>
        {checkout === "success" && (
          <p className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Checkout completed. It may take a minute for your tier to update; refresh the page if the
            upgrade isn&apos;t visible.
          </p>
        )}
        {checkout === "cancel" && (
          <p className="mt-4 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            Checkout was canceled. No charge was made.
          </p>
        )}
        {upsellCopy && (
          <div className="mt-4 rounded-md border border-[var(--b70-crypto-blue)]/40 bg-[var(--b70-crypto-blue)]/10 px-4 py-3 text-sm text-[var(--b70-text)]">
            <strong className="text-[var(--b70-crypto-blue)]">{upsellCopy.title}.</strong>{" "}
            {upsellCopy.body}
          </div>
        )}
      </header>

      <div className="flex gap-6 overflow-x-auto pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory xl:grid xl:grid-cols-3 xl:overflow-visible xl:pb-0 xl:snap-none [&::-webkit-scrollbar]:hidden">
        <PlanCard
          className="min-w-[min(100%,300px)] shrink-0 snap-center sm:min-w-[320px] xl:min-w-0"
          name="Free"
          badge="Explorer"
          price="$0"
          description="Get a feel for the terminal before unlocking the deal-finding toolkit."
          features={[
            "Basic city search (1 city at a time)",
            "Standard sort: recent or price",
            "Delayed data; no Deal Score",
            "50 searches per UTC day",
          ]}
          ctaLabel="Continue free"
          onClick={() => router.push("/coins/upland/property-search")}
        />
        <PlanCard
          className="min-w-[min(100%,300px)] shrink-0 snap-center sm:min-w-[320px] xl:min-w-0"
          name="Upland Pro"
          badge="Deal finder"
          price="$10/mo"
          description="For serious Upland investors who need the full signal stack."
          features={[
            "Full Deal Score (0–100) on every property",
            "Vehicle filter + hidden-gem feed",
            "Advanced filters: yield, markup, neighborhood",
            "Saved searches (up to 10)",
            "5,000 searches per day",
          ]}
          emphasis="popular"
          ctaLabel={loadingTier === "pro" ? "Redirecting..." : "Upgrade to Pro"}
          disabled={loadingTier !== null}
          onClick={() => handleUpgrade("pro")}
        />
        <PlanCard
          className="min-w-[min(100%,300px)] shrink-0 snap-center sm:min-w-[320px] xl:min-w-0"
          name="Upland Elite"
          badge="Power user"
          price="$50/mo"
          description="Real-time alerts and programmatic access for heavy users and teams."
          features={[
            "Everything in Pro",
            "Real-time new-listing alerts (email + webhook)",
            "Portfolio tracking (watch owner wallets)",
            "API access with scoped keys",
            "Early access to new data sources",
          ]}
          emphasis="best_value"
          ctaLabel={loadingTier === "elite" ? "Redirecting..." : "Upgrade to Elite"}
          disabled={loadingTier !== null}
          onClick={() => handleUpgrade("elite")}
        />
      </div>

      <div className="mt-14 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-surface)] p-6 text-sm text-[var(--b70-text-muted)]">
        <p className="mb-2 text-[var(--b70-text)]">Already subscribed?</p>
        <p className="mb-4">
          Manage your Upland subscription — change tier, update payment, or cancel — in the Stripe
          customer portal.
        </p>
        <button
          onClick={handlePortal}
          disabled={loadingTier !== null}
          className="rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-4 py-2 text-sm font-medium text-[var(--b70-text)] transition hover:bg-[var(--b70-surface-alt)] disabled:opacity-50"
        >
          {loadingTier === "portal" ? "Redirecting..." : "Manage subscription"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      <p className="mt-6 text-xs text-[var(--b70-text-muted)] opacity-90">
        Upland Pro and Elite are add-on SKUs and stack on top of your Block70 plan. Quant or admin plan
        holders automatically receive Upland Elite.
      </p>
    </div>
  );
}

export default function UplandPricingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl pb-20 pt-8 text-sm text-[var(--b70-text-muted)]">Loading…</div>}>
      <PricingInner />
    </Suspense>
  );
}
