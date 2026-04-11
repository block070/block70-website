/**
 * GA4 event helper — fires only after gtag is loaded (cookie consent accepted) and
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. Use for funnel / CTA tracking in GA4 Explorations.
 *
 * Recommended names: snake_case, e.g. `upgrade_click`, `signup_complete`, `api_key_created`.
 */
export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) return;
  const g = window.gtag;
  if (typeof g !== "function") return;
  g("event", name, params ?? {});
}
