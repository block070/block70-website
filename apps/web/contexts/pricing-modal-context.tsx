"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PricingUpgradeModal } from "@/components/pricing/pricing-upgrade-modal";
import type { CheckoutPlanKey } from "@/lib/checkout-plan";

export type { CheckoutPlanKey };

type PricingModalContextValue = {
  openModal: (plan?: CheckoutPlanKey) => void;
  closeModal: () => void;
};

const PricingModalContext = createContext<PricingModalContextValue | null>(null);

export function useOptionalPricingModal(): PricingModalContextValue | null {
  return useContext(PricingModalContext);
}

export function usePricingModal(): PricingModalContextValue {
  const ctx = useContext(PricingModalContext);
  if (!ctx) {
    throw new Error("usePricingModal must be used within PricingModalProvider");
  }
  return ctx;
}

export function PricingModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultPlan, setDefaultPlan] = useState<CheckoutPlanKey>("elite");

  const openModal = useCallback((plan?: CheckoutPlanKey) => {
    if (plan) setDefaultPlan(plan);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openModal, closeModal }),
    [openModal, closeModal],
  );

  return (
    <PricingModalContext.Provider value={value}>
      {children}
      <PricingUpgradeModal
        open={open}
        onOpenChange={setOpen}
        defaultPlan={defaultPlan}
      />
    </PricingModalContext.Provider>
  );
}
