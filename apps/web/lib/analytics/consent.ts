/** Must stay in sync with `cookie-consent-banner.tsx`. */
export const COOKIE_CONSENT_STORAGE_KEY = "block70-cookie-consent";

/** Dispatched on `localStorage` accept (and once on mount if already accepted). */
export const COOKIE_CONSENT_ACCEPT_EVENT = "block70-cookie-consent-accepted";

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === "accepted";
  } catch {
    return false;
  }
}
