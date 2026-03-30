/**
 * Lightweight client funnel for soft → email → partial unlock → hard paywall.
 * Values are stored in sessionStorage only (UX aid; server enforces access).
 */

export const ONBOARDING_FUNNEL_STEP_KEY = "block70_onboarding_step";

export type OnboardingFunnelStep =
  | "browse"
  | "soft_paywall"
  | "email_capture"
  | "partial_unlock"
  | "hard_paywall";

export function getFunnelStep(): OnboardingFunnelStep | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(ONBOARDING_FUNNEL_STEP_KEY);
  if (
    v === "browse" ||
    v === "soft_paywall" ||
    v === "email_capture" ||
    v === "partial_unlock" ||
    v === "hard_paywall"
  ) {
    return v;
  }
  return null;
}

export function setFunnelStep(step: OnboardingFunnelStep): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ONBOARDING_FUNNEL_STEP_KEY, step);
}
