"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { clsx } from "clsx";
import { createCheckoutSession } from "@/lib/billing";
import { getToken } from "@/lib/auth";
import type { CheckoutPlanKey } from "@/lib/checkout-plan";

const PLANS: {
  key: CheckoutPlanKey;
  name: string;
  price: string;
  blurb: string;
}[] = [
  { key: "pro", name: "Pro", price: "$29/mo", blurb: "Medium signals tier, 50 AI queries/day." },
  { key: "elite", name: "Elite", price: "$99/mo", blurb: "Full scores, dense signals, unlimited AI." },
  { key: "quant", name: "Quant", price: "$299/mo", blurb: "Everything + REST API keys." },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPlan: CheckoutPlanKey;
};

export function PricingUpgradeModal({ open, onOpenChange, defaultPlan }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<CheckoutPlanKey>(defaultPlan);
  const [loading, setLoading] = useState<CheckoutPlanKey | null>(null);

  useEffect(() => {
    if (open) setSelected(defaultPlan);
  }, [open, defaultPlan]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  async function checkout(plan: CheckoutPlanKey) {
    if (!getToken()) {
      onOpenChange(false);
      router.push("/register?next=/pricing");
      return;
    }
    setLoading(plan);
    try {
      await createCheckoutSession(plan);
    } catch (e) {
      console.error(e);
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--b70-border)] p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
              Upgrade
            </p>
            <h2 id="pricing-modal-title" className="mt-1 text-lg font-semibold text-[var(--b70-text)]">
              Choose your plan
            </h2>
            <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
              You will be redirected to secure Stripe checkout.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--b70-text-muted)] hover:bg-[var(--b70-bg)] hover:text-[var(--b70-text)]"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 p-4">
          {PLANS.map((p) => {
            const active = selected === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelected(p.key)}
                className={clsx(
                  "w-full rounded-xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-[var(--b70-crypto-blue)] bg-[var(--b70-crypto-blue)]/10"
                    : "border-[var(--b70-border)] bg-[var(--b70-bg)] hover:border-[var(--b70-crypto-blue)]/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--b70-text)]">{p.name}</span>
                  <span className="font-mono text-sm text-[var(--b70-text)]">{p.price}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--b70-text-muted)]">{p.blurb}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--b70-border)] p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-lg border border-[var(--b70-border)] px-4 py-2.5 text-sm font-medium text-[var(--b70-text)] hover:bg-[var(--b70-bg)]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading !== null}
            className="rounded-lg bg-[var(--b70-crypto-blue)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            onClick={() => checkout(selected)}
          >
            {loading ? "Redirecting…" : `Continue with ${PLANS.find((p) => p.key === selected)?.name ?? ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
