// Upland-specific Stripe helpers used by the pricing page.
//
// Parallel to lib/billing.ts (which handles the global Free/Pro/Elite/Quant
// plans). Upland is an add-on SKU: subscribing here does not change the user's
// global plan -- it writes a row into product_entitlements on the API side.

import { getToken } from "./auth";

export type UplandTierPaid = "pro" | "elite";

export async function createUplandCheckoutSession(
  tier: UplandTierPaid,
): Promise<void> {
  const token = getToken();
  if (!token) {
    window.location.href = `/register?next=${encodeURIComponent(
      `/coins/upland/pricing?plan=${tier}`,
    )}`;
    return;
  }

  const res = await fetch("/api/v1/billing/upland/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tier }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : "Could not start checkout",
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Stripe session missing redirect URL");
  window.location.href = data.url;
}

export async function openUplandBillingPortal(): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch("/api/v1/billing/upland/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not open billing portal");
  const data = (await res.json()) as { url?: string };
  if (data.url) window.location.href = data.url;
}
