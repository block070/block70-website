import { API_BASE_URL } from "./api";
import { getToken } from "./auth";

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
  if (!res.ok) throw new Error(`Bots API error: ${res.status}`);
  return (await res.json()) as T;
}

export type BotConfig = {
  min_confidence?: number;
  signal_types?: string[];
  token_filter?: string[];
  /** Stop loss per position, percent (0–100). Stored for automation; execution may be manual or future engine. */
  stop_loss_pct?: number;
  /** Max notional per trade (USD). */
  max_position_usd?: number;
  /** Hard cap on entries per UTC day. */
  max_daily_trades?: number;
  /** Max fraction of equity to risk per signal (0–100). */
  risk_per_trade_pct?: number;
  /** When true, prefer paper / simulated fills (future execution engine). */
  paper_trading?: boolean;
};

export type BotInfo = {
  id: number;
  platform: string;
  channel_id: string;
  is_active: boolean;
  config_json: BotConfig | null;
  strategy_id?: number | null;
  created_at: string;
  updated_at: string;
  signals_sent_24h?: number;
};

export async function listBots(): Promise<BotInfo[]> {
  const r = await fetchWithAuth<BotInfo[]>("/api/v1/bots");
  return Array.isArray(r) ? r : [];
}

export async function createBot(payload: {
  platform: "telegram" | "discord";
  bot_token: string;
  channel_id: string;
  config_json?: BotConfig | null;
  strategy_id?: number | null;
}): Promise<BotInfo> {
  return fetchWithAuth<BotInfo>("/api/v1/bots", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBot(botId: number): Promise<BotInfo> {
  return fetchWithAuth<BotInfo>(`/api/v1/bots/${botId}`);
}

export async function updateBot(
  botId: number,
  payload: {
    is_active?: boolean;
    config_json?: BotConfig | null;
    strategy_id?: number | null;
  }
): Promise<BotInfo> {
  return fetchWithAuth<BotInfo>(`/api/v1/bots/${botId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBot(botId: number): Promise<{ status: string; id: number }> {
  return fetchWithAuth(`/api/v1/bots/${botId}`, { method: "DELETE" });
}
