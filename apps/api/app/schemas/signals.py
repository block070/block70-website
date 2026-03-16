from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class ArbitrageRaw(BaseModel):
    """Raw arbitrage data as returned by a connector (mock for now)."""

    pair: str  # e.g. "SOL/USDC"
    chain: str  # e.g. "solana"
    dex_buy: str
    dex_sell: str
    spread_pct: float
    volume_usd: float
    latency_ms: int
    detected_at: datetime
    external_id: Optional[str] = None


class ArbitrageSignal(BaseModel):
    """Typed arbitrage signal extracted from raw connector data."""

    source: str
    pair: str
    chain: str
    dex_buy: str
    dex_sell: str
    spread_pct: float
    volume_usd: float
    latency_ms: int
    detected_at: datetime
    external_id: Optional[str] = None

    dedup_key: str


class MinerRaw(BaseModel):
    """Raw miner ROI data returned by a connector (mock for now)."""

    hardware_model: str
    algorithm: str
    token_symbol: str
    hash_rate_th: float
    power_w: int
    electricity_cost_usd_per_kwh: float
    hardware_cost_usd: float
    revenue_usd_per_day: float
    detected_at: datetime
    external_id: Optional[str] = None


class MinerSignal(BaseModel):
    """Typed miner ROI signal extracted from raw data."""

    source: str
    hardware_model: str
    algorithm: str
    token_symbol: str
    hash_rate_th: float
    power_w: int
    electricity_cost_usd_per_kwh: float
    hardware_cost_usd: float
    revenue_usd_per_day: float
    detected_at: datetime
    external_id: Optional[str] = None

    # Derived metrics for scoring/normalization
    daily_profit_usd: float
    roi_percent_per_year: float
    payback_days: float

    dedup_key: str


class WalletRaw(BaseModel):
    """Raw wallet activity event as returned by a connector (mock for now)."""

    wallet_address: str
    chain: str
    token_symbol: str
    action: str  # e.g. "buy", "sell", "add_liquidity"
    amount_usd: float
    realized_pnl_30d_pct: float
    realized_trades_30d: int
    win_rate_30d: float  # 0–1
    tx_hash: str
    detected_at: datetime
    external_id: Optional[str] = None


class WalletSignal(BaseModel):
    """Typed wallet-follow signal extracted from raw wallet activity."""

    source: str
    wallet_address: str
    chain: str
    token_symbol: str
    action: str
    amount_usd: float
    realized_pnl_30d_pct: float
    realized_trades_30d: int
    win_rate_30d: float
    tx_hash: str
    detected_at: datetime
    external_id: Optional[str] = None

    # Derived fields for scoring
    conviction_score: float  # size-adjusted conviction

    dedup_key: str


class SignalRead(BaseModel):
    """API response schema for the unified Signal model (signals table)."""

    id: int
    signal_type: str
    token_symbol: Optional[str] = None
    token_address: Optional[str] = None
    chain: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    signal_strength: float
    confidence_score: float
    source: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}

