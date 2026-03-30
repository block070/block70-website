"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, Database, Radio, Sparkles } from "lucide-react";

import { PlanCard } from "@/components/pricing/plan-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { getToken } from "@/lib/auth";
import { createBillingPortalSession, createCheckoutSession, getSubscription } from "@/lib/billing";

export default function StorePage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    getSubscription()
      .then((s) => setPlanType(s.plan_type))
      .catch(() => setPlanType(null));
  }, []);

  async function handleUpgrade(plan: "pro" | "elite" | "quant") {
    if (!getToken()) {
      router.push("/register");
      return;
    }
    setLoadingPlan(plan);
    try {
      await createCheckoutSession(plan);
    } catch {
      setLoadingPlan(null);
    }
  }

  const authed = Boolean(getToken());

  return (
    <div className="mx-auto max-w-5xl space-y-14 px-4 py-12">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
          Marketplace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--b70-text)] md:text-4xl">
          Plans, tools &amp; rewards
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-[var(--b70-text-muted)] md:mx-0">
          Choose a bundle for real-time signals and AI, add API data access, or spend Blocks on perks—
          all in one place.
        </p>
        {authed && planType ? (
          <p className="text-xs text-[var(--b70-text-muted)]">
            Current plan:{" "}
            <span className="font-medium capitalize text-[var(--b70-text)]">{planType}</span>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="bundles-heading">
        <h2 id="bundles-heading" className="mb-6 text-lg font-semibold text-[var(--b70-text)]">
          Bundles
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <PlanCard
            name="Starter"
            badge="Free"
            price="$0"
            description="Explore markets, delayed signals, and rate-limited AI—perfect to learn the platform."
            features={[
              "Basic coin and market data",
              "Limited / delayed Block70 score on select surfaces",
              "AI: 5 questions / day",
              "Shallow signals & opportunities lists",
            ]}
            ctaLabel="Get started"
            onClick={() => router.push("/register")}
          />
          <PlanCard
            name="Pro"
            badge="Most popular"
            price="$29/mo"
            description="Act on real-time scoring, full chart stack, and actionable alerts."
            features={[
              "Near-real-time Block70 scoring",
              "Full charts (RSI, MACD, SMAs, volume & momentum)",
              "Trending and category insights",
              "AI: 50 questions / day",
            ]}
            highlighted
            ctaLabel={loadingPlan === "pro" ? "Redirecting…" : "Upgrade to Pro"}
            disabled={loadingPlan !== null}
            onClick={() => handleUpgrade("pro")}
          />
          <PlanCard
            name="Elite"
            badge="Desk"
            price="$99/mo"
            description="Everything in Pro with whale-style signals, sharper feeds, and custom routing."
            features={[
              "Everything in Pro",
              "Full opportunities & smart-wallet depth",
              "High-density real-time signals",
              "Unlimited AI (fair use)",
            ]}
            ctaLabel={loadingPlan === "elite" ? "Redirecting…" : "Upgrade to Elite"}
            disabled={loadingPlan !== null}
            onClick={() => handleUpgrade("elite")}
          />
          <PlanCard
            name="Quant"
            badge="API"
            price="$299/mo"
            description="Everything in Elite plus REST API keys and automation-grade limits."
            features={[
              "Everything in Elite",
              "Developer API keys & analytics",
              "Highest daily API limits",
              "Built for systematic workflows",
            ]}
            ctaLabel={loadingPlan === "quant" ? "Redirecting…" : "Upgrade to Quant"}
            disabled={loadingPlan !== null}
            onClick={() => handleUpgrade("quant")}
          />
        </div>
        <p className="mt-4 text-center text-xs text-[var(--b70-text-muted)] md:text-left">
          Detailed comparison also on{" "}
          <Link href="/pricing" className="text-blue-600 hover:underline dark:text-blue-400">
            Pricing
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="products-heading">
        <h2 id="products-heading" className="mb-6 text-lg font-semibold text-[var(--b70-text)]">
          Products &amp; access
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:!translate-y-0 hover:!shadow-none">
            <CardHeaderWithIcon
              icon={<Radio className="h-4 w-4 text-emerald-500" aria-hidden />}
              title="Signals subscription"
              subtitle="Real-time and delayed feeds tied to your plan"
            />
            <div className="space-y-3 px-4 pb-4 text-sm text-[var(--b70-text-muted)]">
              <ul className="list-none space-y-1 text-xs">
                <li>• Signal types and confidence filters in Automation</li>
                <li>• Pro+ unlocks real-time delivery</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="text-xs"
                  onClick={() => void handleUpgrade("pro")}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === "pro" ? "Redirecting…" : "Go Pro"}
                </Button>
                <Link href="/signals">
                  <Button variant="outline" className="text-xs">
                    View signals
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
          <Card className="hover:!translate-y-0 hover:!shadow-none">
            <CardHeaderWithIcon
              icon={<Sparkles className="h-4 w-4 text-violet-400" />}
              title="Premium AI"
              subtitle="Search, synthesis, higher limits on paid tiers"
            />
            <div className="space-y-3 px-4 pb-4 text-sm text-[var(--b70-text-muted)]">
              <ul className="list-none space-y-1 text-xs">
                <li>• Natural-language answers with Block70 context</li>
                <li>• Usage and quotas on Billing &amp; usage</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Link href="/ai-search">
                  <Button className="text-xs">Open AI search</Button>
                </Link>
                <Link href="/usage">
                  <Button variant="outline" className="text-xs">
                    Usage &amp; limits
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
          <Card className="hover:!translate-y-0 hover:!shadow-none">
            <CardHeaderWithIcon
              icon={<Database className="h-4 w-4 text-sky-400" />}
              title="Data access"
              subtitle="REST API for signals, market, wallets, and more"
            />
            <div className="space-y-3 px-4 pb-4 text-sm text-[var(--b70-text-muted)]">
              <ul className="list-none space-y-1 text-xs">
                <li>• API keys, scopes, and rate limits</li>
                <li>• Reference docs and try-it flows</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Link href="/developers">
                  <Button className="text-xs">API &amp; keys</Button>
                </Link>
                <Link href="/apidocs">
                  <Button variant="outline" className="text-xs">
                    API reference
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-4 py-4 text-sm text-[var(--b70-text-muted)] md:flex-row md:items-center md:justify-between">
        <p>
          Manage billing, invoices, and cancellation in the Stripe customer portal. Upgrade anytime—
          cancel when you want.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/usage">
            <Button variant="outline" className="text-xs">
              Billing &amp; usage
            </Button>
          </Link>
          {authed ? (
            <Button
              variant="outline"
              className="text-xs"
              onClick={() => createBillingPortalSession().catch(() => {})}
            >
              Open billing portal
            </Button>
          ) : (
            <Link href="/register">
              <Button variant="outline" className="text-xs">
                Sign in to manage billing
              </Button>
            </Link>
          )}
        </div>
      </section>

      <section>
        <Card className="border-amber-500/20 bg-amber-500/5 hover:!translate-y-0 hover:!shadow-none">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-[var(--b70-text)]">Blocks rewards store</h3>
              <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
                Earn Blocks from check-ins, referrals, and community actions—redeem for perks in the
                dedicated catalog.
              </p>
            </div>
            <Link href="/rewards/store" className="shrink-0">
              <Button className="gap-2">
                Open Blocks store
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

function CardHeaderWithIcon({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--b70-border)] px-4 py-3">
      <div>
        <h3 className="heading-md flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <p className="mt-0.5 small">{subtitle}</p>
      </div>
    </div>
  );
}
