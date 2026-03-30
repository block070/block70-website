"use client";

import { useState, type ReactNode } from "react";
import { ExchangeAffiliateProvider } from "@/contexts/exchange-affiliate-context";
import { TopNav } from "./top-nav";
import { ServiceHealthBanner } from "./service-health-banner";
import { Sidebar } from "./sidebar";
import { LegalFooter } from "@/components/legal/legal-footer";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import { StickyUpgradePill } from "@/components/paywall/sticky-upgrade-pill";
import { ActivityPing } from "@/components/layout/activity-ping";
import { PricingModalProvider } from "@/contexts/pricing-modal-context";
import { isDemoMode } from "@/lib/demo";

type AppLayoutProps = {
  children: ReactNode;
  rightPanel?: ReactNode;
};

export function AppLayout({ children, rightPanel }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const demo = isDemoMode();

  return (
    <PricingModalProvider>
    <div className="flex min-h-screen flex-col bg-[var(--b70-bg)]">
      <TopNav />
      <div className="flex min-h-0 flex-1 flex-col pt-14 print:pt-0">
        <div className="print:hidden">
          <ServiceHealthBanner />
        </div>
        <div className="flex min-h-0 flex-1">
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="fixed left-4 top-16 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] md:hidden"
          aria-label="Toggle sidebar"
        >
          <MenuIcon />
        </button>

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="min-w-0 flex-1 px-4 py-4 pl-4 md:pl-4">
          <ExchangeAffiliateProvider>
            <div className="mx-auto max-w-6xl">
              {demo && (
                <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
                  You are viewing a demo environment. Some data is seeded for
                  illustration and may not reflect live markets.
                </div>
              )}
              {children}
            </div>
          </ExchangeAffiliateProvider>
        </main>

        {rightPanel ? (
          <aside className="hidden w-72 shrink-0 border-l border-[var(--b70-border)] bg-[var(--b70-card)] xl:block">
            <div className="sticky top-20 p-4">{rightPanel}</div>
          </aside>
        ) : null}
        </div>
      </div>

      <LegalFooter />
      <CookieConsentBanner />
      <ActivityPing />
      <StickyUpgradePill />
    </div>
    </PricingModalProvider>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}
