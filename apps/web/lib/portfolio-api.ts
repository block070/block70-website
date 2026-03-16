import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type PortfolioDto = {
  id: number;
  user_id: number;
  portfolio_name: string;
  total_value_usd: number;
  total_profit_loss: number;
  created_at: string;
  updated_at: string;
};

export type PortfolioTokenBalanceDto = {
  id: number;
  portfolio_id: number;
  token_symbol: string;
  token_address: string;
  chain: string;
  balance: number;
  value_usd: number;
  updated_at: string;
};

export type PortfolioTransactionDto = {
  id: number;
  portfolio_id: number;
  token_symbol: string;
  transaction_type: string;
  amount: number;
  value_usd: number;
  tx_hash: string;
  timestamp: string;
};

export type PortfolioMetricsDto = {
  total_value_usd: number;
  total_profit_loss: number;
  best_performing: Array<{
    token_symbol: string;
    chain: string;
    value_usd: number;
    balance: number;
  }>;
  worst_performing: Array<{
    token_symbol: string;
    chain: string;
    value_usd: number;
    balance: number;
  }>;
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
  if (!res.ok) throw new Error(`Portfolio API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getPortfolio(): Promise<PortfolioDto> {
  return fetchWithAuth<PortfolioDto>("/api/v1/portfolio");
}

export async function getPortfolioTokens(): Promise<PortfolioTokenBalanceDto[]> {
  return fetchWithAuth<PortfolioTokenBalanceDto[]>("/api/v1/portfolio/tokens");
}

export async function getPortfolioTransactions(
  limit = 50,
): Promise<PortfolioTransactionDto[]> {
  return fetchWithAuth<PortfolioTransactionDto[]>(
    `/api/v1/portfolio/transactions?limit=${limit}`,
  );
}

export async function addPortfolioWallet(
  wallet_address: string,
  chain: string,
): Promise<{ id: number; portfolio_id: number; wallet_address: string; chain: string; created_at: string }> {
  return fetchWithAuth("/api/v1/portfolio/add-wallet", {
    method: "POST",
    body: JSON.stringify({ wallet_address, chain }),
  });
}

export async function syncPortfolio(): Promise<{ status: string; portfolio_id: number }> {
  return fetchWithAuth("/api/v1/portfolio/sync", { method: "POST" });
}

export async function getPortfolioMetrics(): Promise<PortfolioMetricsDto> {
  return fetchWithAuth<PortfolioMetricsDto>("/api/v1/portfolio/metrics");
}

export async function getSmartMoneyOverlap(): Promise<
  Array<{
    token_symbol: string;
    wallet_address: string;
    wallet_win_rate?: number;
    wallet_profit_usd?: number;
    message?: string;
  }>
> {
  return fetchWithAuth("/api/v1/portfolio/insights/smart-money-overlap");
}
