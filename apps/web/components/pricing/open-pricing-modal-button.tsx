"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useOptionalPricingModal } from "@/contexts/pricing-modal-context";
import type { CheckoutPlanKey } from "@/lib/checkout-plan";

type Props = {
  plan?: CheckoutPlanKey;
  children: ReactNode;
  className?: string;
};

/**
 * Text/button control that opens the global pricing modal when wrapped in AppLayout;
 * falls back to /pricing navigation.
 */
export function OpenPricingModalButton({ plan = "elite", children, className }: Props) {
  const ctx = useOptionalPricingModal();
  const router = useRouter();

  return (
    <button
      type="button"
      className={clsx(
        "font-medium underline underline-offset-2 hover:opacity-90",
        className,
      )}
      onClick={() => (ctx ? ctx.openModal(plan) : router.push("/pricing"))}
    >
      {children}
    </button>
  );
}
