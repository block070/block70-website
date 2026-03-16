import { fetchJson } from "./api";

export type UserStrategy = {
  id: number;
  user_identifier: string;
  strategy_name: string;
  conditions: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export async function getStrategies(): Promise<UserStrategy[]> {
  return fetchJson<UserStrategy[]>("/api/v1/strategies");
}

export async function createStrategy(payload: {
  user_identifier: string;
  strategy_name: string;
  conditions: Record<string, any>;
}): Promise<UserStrategy> {
  return fetchJson<UserStrategy>("/api/v1/strategies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteStrategy(id: number): Promise<void> {
  await fetchJson(`/api/v1/strategies/${id}`, { method: "DELETE" });
}

