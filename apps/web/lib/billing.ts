import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

type Subscription = {
  id?: number;
  plan_type: "free" | "pro" | "elite" | "quant";
  status: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
};

export async function createCheckoutSession(planType: "pro" | "elite" | "quant") {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/billing/create-checkout-session?plan_type=${planType}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to create checkout session");
  }

  const data = (await res.json()) as { checkout_url: string };
  window.location.href = data.checkout_url;
}

export async function createBillingPortalSession() {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/billing/portal`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to create billing portal session");
  }

  const data = (await res.json()) as { portal_url: string };
  window.location.href = data.portal_url;
}

export async function getSubscription(): Promise<Subscription> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/billing/subscription`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to load subscription");
  }

  return (await res.json()) as Subscription;
}

