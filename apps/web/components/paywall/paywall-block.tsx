"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYWALL_COPY } from "@/lib/paywall-copy";
import { clsx } from "clsx";
import { useOptionalPricingModal } from "@/contexts/pricing-modal-context";
import type { CheckoutPlanKey } from "@/lib/checkout-plan";

export type PaywallBlockVariant = "soft" | "hard";

type Props = {
  children?: ReactNode;
  variant?: PaywallBlockVariant;
  score?: string | number;
  headline?: string;
  subhead?: string;
  bullets?: string[];
  primaryCtaLabel?: string;
  href?: string;
  urgencyLabel?: string;
  socialProof?: string;
  /** Email capture (passwordless lead). */
  showEmailCapture?: boolean;
  onEmailSubmit?: (email: string) => Promise<void>;
  /** Opens global pricing modal instead of navigating to `href`. */
  checkoutViaModal?: boolean;
  defaultCheckoutPlan?: CheckoutPlanKey;
  className?: string;
};

export function PaywallBlock({
  children,
  variant = "soft",
  score,
  headline = PAYWALL_COPY.headlineDetected,
  subhead = PAYWALL_COPY.subSmartMoney,
  bullets = [...PAYWALL_COPY.bulletsDefault],
  primaryCtaLabel = PAYWALL_COPY.ctaElite,
  href = "/pricing",
  urgencyLabel,
  socialProof,
  showEmailCapture = false,
  onEmailSubmit,
  checkoutViaModal = false,
  defaultCheckoutPlan = "elite",
  className,
}: Props) {
  const router = useRouter();
  const pricingModal = useOptionalPricingModal();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const borderClass =
    variant === "hard"
      ? "border-amber-500/50 ring-1 ring-amber-500/25"
      : "border-amber-500/35";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onEmailSubmit || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onEmailSubmit(email.trim());
    } catch (msg) {
      setError(msg instanceof Error ? msg.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border bg-slate-950/35",
        borderClass,
        className,
      )}
    >
      {children ? (
        <div className="pointer-events-none max-h-40 select-none overflow-hidden blur-sm opacity-35">
          {children}
        </div>
      ) : null}

      <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-start md:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Lock className="h-5 w-5 shrink-0 text-amber-300" aria-hidden />
            {urgencyLabel ? (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                {urgencyLabel}
              </span>
            ) : null}
            {variant === "hard" ? (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                Full unlock
              </span>
            ) : null}
          </div>

          <div>
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-50">
              <Sparkles className="h-5 w-5 text-amber-400" aria-hidden />
              {headline}
            </p>
            {score != null && score !== "" ? (
              <p className="mt-1 font-mono text-sm text-emerald-300/90">
                Block70 Score:{" "}
                <span className="font-semibold text-emerald-200">{score}</span>
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{subhead}</p>
          </div>

          {socialProof ? (
            <p className="text-xs text-slate-500">{socialProof}</p>
          ) : null}

          <ul className="space-y-1.5 text-xs text-slate-400">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {showEmailCapture && onEmailSubmit ? (
            <form onSubmit={handleSubmit} className="mt-2 space-y-2">
              <p className="text-[11px] text-slate-500">{PAYWALL_COPY.emailCaptureHint}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none"
                />
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-10 shrink-0 bg-amber-500 text-slate-950 hover:bg-amber-400"
                >
                  {busy ? "…" : "Unlock preview"}
                </Button>
              </div>
              {error ? <p className="text-xs text-rose-400">{error}</p> : null}
            </form>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {checkoutViaModal ? (
                <Button
                  type="button"
                  className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                  onClick={() => {
                    if (pricingModal) {
                      pricingModal.openModal(defaultCheckoutPlan);
                    } else {
                      router.push(href);
                    }
                  }}
                >
                  {primaryCtaLabel}
                </Button>
              ) : (
                <Link href={href}>
                  <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400">
                    {primaryCtaLabel}
                  </Button>
                </Link>
              )}
              <Link href="/store">
                <Button variant="outline">Marketplace</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
