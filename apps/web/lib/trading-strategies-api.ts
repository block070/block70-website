import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

/** Browser calls Next proxy (cookie session); server/tooling can use FastAPI URL. */
function tradingStrategiesBase(): string {
  return typeof window !== "undefined"
    ? "/api/trading-strategies"
    : `${API_BASE_URL}/api/v1/trading-strategies`;
}

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

export type EquityCurvePoint = { t: string; equity: number };

export type StrategyBacktestDto = {
  id: number;
  strategy_id: number;
  total_trades: number;
  /** 0–1 fraction */
  win_rate: number;
  average_profit: number;
  max_drawdown: number;
  total_return_pct: number;
  equity_curve: EquityCurvePoint[];
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

export type StrategyExecutionV1 = {
  take_profit_pct: number;
  stop_loss_pct: number;
  max_hold_hours: number;
  stake_usd: number;
  starting_capital: number;
  max_entries_per_run: number;
};

function tsUrl(path: string): string {
  const base = tradingStrategiesBase();
  if (!path || path === "/") return base;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const url = tsUrl(path);
  const res = await fetch(url, {
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
  return fetchWithAuth<TradingStrategyDto[]>("/");
}

export async function getTradingStrategy(id: number): Promise<TradingStrategyDto> {
  return fetchWithAuth<TradingStrategyDto>(`/${id}`);
}

export async function createTradingStrategy(payload: {
  strategy_name: string;
  description?: string | null;
  conditions_json?: Record<string, unknown>;
  entry_rules?: string | null;
  exit_rules?: string | null;
  execution?: StrategyExecutionV1 | null;
}): Promise<TradingStrategyDto> {
  return fetchWithAuth<TradingStrategyDto>("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getStrategyBacktest(
  strategyId: number,
  run = false
): Promise<StrategyBacktestDto> {
  const q = run ? "?run=true" : "";
  return fetchWithAuth<StrategyBacktestDto>(`/${strategyId}/backtest${q}`);
}

export type StrategyBacktestRunBody = {
  starting_capital?: number;
  stake_usd?: number;
  refresh_trades?: boolean;
};

export type StrategyBacktestRunResponse = {
  metrics: StrategyBacktestDto;
  trades: StrategySimulatedTradeDto[];
  equity_curve: EquityCurvePoint[];
};

export async function runStrategyBacktest(
  strategyId: number,
  body: StrategyBacktestRunBody = {}
): Promise<StrategyBacktestRunResponse> {
  return fetchWithAuth<StrategyBacktestRunResponse>(
    `/${strategyId}/backtest/run`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function getStrategyTrades(
  strategyId: number
): Promise<StrategySimulatedTradeDto[]> {
  return fetchWithAuth<StrategySimulatedTradeDto[]>(
    `/${strategyId}/trades`
  );
}

export async function runStrategySimulation(
  strategyId: number
): Promise<{ status: string; trades_created: number }> {
  return fetchWithAuth(`/${strategyId}/simulate`, {
    method: "POST",
  });
}

async function fetchPublic<T>(path: string): Promise<T> {
  const url = tsUrl(path);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Trading strategies API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getStrategyTemplates(): Promise<{
  templates: StrategyTemplateDto[];
}> {
  return fetchPublic<{ templates: StrategyTemplateDto[] }>("/templates");
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
    total_return_pct?: number;
  }>;
}> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (publicOnly) params.set("public_only", "true");
  return fetchPublic(
    `/leaderboard?${params.toString()}`
  ) as Promise<{
    leaderboard: Array<{
      rank: number;
      strategy_id: number;
      strategy_name: string;
      win_rate: number;
      average_profit: number;
      total_trades: number;
      max_drawdown: number;
      total_return_pct?: number;
    }>;
  }>;
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
    total_return_pct?: number;
  } | null;
}> {
  return fetchPublic(`/share/${strategyId}`);
}

/** Public strategy by ID (only strategies with is_public=true). No auth. */
export async function getPublicStrategyById(
  strategyId: number
): Promise<TradingStrategyDto> {
  return fetchPublic<TradingStrategyDto>(`/public/${strategyId}`);
}

/** List public strategies (no auth). */
export async function getPublicStrategies(limit = 50): Promise<
  TradingStrategyDto[]
> {
  const res = await fetch(
    `${tradingStrategiesBase()}/public?limit=${limit}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load public strategies");
  return (await res.json()) as TradingStrategyDto[];
}
