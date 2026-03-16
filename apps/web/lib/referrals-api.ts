import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type ReferralMe = {
  referral_code: string;
  referral_link: string;
};

export type ReferralDashboard = {
  referral_code: string;
  referral_link: string;
  referral_count: number;
  rewards_earned: number;
};

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Referrals API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getReferralMe(baseUrl?: string): Promise<ReferralMe> {
  const q = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : "";
  return fetchWithAuth<ReferralMe>(`/api/v1/referrals/me${q}`);
}

export async function getReferralDashboard(
  baseUrl?: string
): Promise<ReferralDashboard> {
  const q = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : "";
  return fetchWithAuth<ReferralDashboard>(`/api/v1/referrals/dashboard${q}`);
}
