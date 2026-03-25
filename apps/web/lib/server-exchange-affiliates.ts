import { getApiBaseUrl } from "./api";

/** Server-only fetch of active affiliate URL templates (short cache). */
export async function fetchExchangeAffiliateTemplates(): Promise<Record<string, string>> {
  const base = getApiBaseUrl();
  if (!base) return {};
  try {
    const res = await fetch(`${base}/api/v1/exchange-affiliate-links`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const j = (await res.json()) as { templates?: Record<string, string> };
    return j.templates ?? {};
  } catch {
    return {};
  }
}
