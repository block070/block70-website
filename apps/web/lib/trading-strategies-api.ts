import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

export type TradingStrategyDto = {
  id: number;
  user_id: number;
  strategy_name: string;
  description: string | null;
  conditions_json: string;
  entry_rules: string | null;
  exit_rules: string | null;
  is_public?: boolean;
  created_at: string;
  updated_at: string;
};

export type StrategyBacktestDto = {
  id: number;
  strategy_id: number;
  total_trades: number;
  win_rate: number;
  average_profit: number;
  max_drawdown: number;
  created_at: string;
};

export type StrategySimulatedTradeDto = {
  id: number;
  strategy_id: number;
  token_symbol: string;
  entry_price: number;
  exit_price: number;
  profit_percent: number;
  entry_time: string;
  exit_time: string;
  created_at: string;
};

export type StrategyTemplateDto = {
  id: string;
  name: string;
  description: string;
  conditions_json: Record<string, unknown>;
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
  if (!res.ok) throw new Error(`Trading strategies API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getTradingStrategies(): Promise<TradingStrategyDto[]> {
  return fetchWithAuth<TradingStrategyDto[]>("/api/v1/trading-strategies");
}

export async function getTradingStrategy(id: number): Promise<TradingStrategyDto> {
  return fetchWithAuth<TradingStrategyDto>(`/api/v1/trading-strategies/${id}`);
}

export async function createTradingStrategy(payload: {
  strategy_name: string;
  description?: string | null;
  conditions_json?: Record<string, unknown>;
  entry_rules?: string | null;
  exit_rules?: string | null;
}): Promise<TradingStrategyDto> {
  return fetchWithAuth<TradingStrategyDto>("/api/v1/trading-strategies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getStrategyBacktest(
  strategyId: number,
  run = false
): Promise<StrategyBacktestDto> {
  const q = run ? "?run=true" : "";
  return fetchWithAuth<StrategyBacktestDto>(
    `/api/v1/trading-strategies/${strategyId}/backtest${q}`
  );
}

export async function getStrategyTrades(
  strategyId: number
): Promise<StrategySimulatedTradeDto[]> {
  return fetchWithAuth<StrategySimulatedTradeDto[]>(
    `/api/v1/trading-strategies/${strategyId}/trades`
  );
}

export async function runStrategySimulation(
  strategyId: number
): Promise<{ status: string; trades_created: number }> {
  return fetchWithAuth(`/api/v1/trading-strategies/${strategyId}/simulate`, {
    method: "POST",
  });
}

export async function getStrategyTemplates(): Promise<{
  templates: StrategyTemplateDto[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/trading-strategies/templates`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load templates");
  return (await res.json()) as { templates: StrategyTemplateDto[] };
}

export async function getStrategyLeaderboard(
  limit = 20,
  publicOnly = false
): Promise<{
  leaderboard: Array<{
    rank: number;
    strategy_id: number;
    strategy_name: string;
    win_rate: number;
    average_profit: number;
    total_trades: number;
    max_drawdown: number;
  }>;
}> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (publicOnly) params.set("public_only", "true");
  const res = await fetch(
    `${API_BASE_URL}/api/v1/trading-strategies/leaderboard?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load leaderboard");
  return (await res.json()) as {
    leaderboard: Array<{
      rank: number;
      strategy_id: number;
      strategy_name: string;
      win_rate: number;
      average_profit: number;
      total_trades: number;
      max_drawdown: number;
    }>;
  };
}

export async function getPublicStrategy(strategyId: number): Promise<{
  strategy_id: number;
  strategy_name: string;
  description: string | null;
  backtest: {
    total_trades: number;
    win_rate: number;
    average_profit: number;
    max_drawdown: number;
  } | null;
}> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/trading-strategies/share/${strategyId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Strategy not found");
  return (await res.json()) as {
    strategy_id: number;
    strategy_name: string;
    description: string | null;
    backtest: {
      total_trades: number;
      win_rate: number;
      average_profit: number;
      max_drawdown: number;
    } | null;
  };
}

/** Public strategy by ID (only strategies with is_public=true). No auth. */
export async function getPublicStrategyById(
  strategyId: number
): Promise<TradingStrategyDto> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/trading-strategies/public/${strategyId}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Strategy not found");
  return (await res.json()) as TradingStrategyDto;
}

/** List public strategies (no auth). */
export async function getPublicStrategies(limit = 50): Promise<
  TradingStrategyDto[]
> {
  const res = await fetch(
    `${API_BASE_URL}/api/v1/trading-strategies/public?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load public strategies");
  return (await res.json()) as TradingStrategyDto[];
}
