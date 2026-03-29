from __future__ import annotations

import json
from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.strategy_execution import StrategyExecutionV1

if TYPE_CHECKING:
    from app.models.strategy_backtest import StrategyBacktest


class StrategyConditionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    strategy_id: int
    condition_type: str
    condition_value: str
    created_at: datetime


class TradingStrategyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    strategy_name: str
    description: Optional[str]
    conditions_json: str
    entry_rules: Optional[str]
    exit_rules: Optional[str]
    is_public: bool = False
    created_at: datetime
    updated_at: datetime


class TradingStrategyCreate(BaseModel):
    strategy_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    conditions_json: Dict[str, Any] = Field(default_factory=dict)
    entry_rules: Optional[str] = None
    exit_rules: Optional[str] = None
    is_public: bool = False
    execution: Optional[StrategyExecutionV1] = None


class StrategyBacktestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    strategy_id: int
    total_trades: int
    win_rate: float
    average_profit: float
    max_drawdown: float
    total_return_pct: float = 0.0
    equity_curve: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class StrategySimulatedTradeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    strategy_id: int
    token_symbol: str
    entry_price: float
    exit_price: float
    profit_percent: float
    entry_time: datetime
    exit_time: datetime
    created_at: datetime


class StrategyBacktestRunRequest(BaseModel):
    """Optional overrides for one backtest run (POST /backtest/run)."""

    starting_capital: Optional[float] = Field(None, ge=100.0, le=1e12)
    stake_usd: Optional[float] = Field(None, ge=1.0, le=1e9)
    refresh_trades: bool = False


class StrategyBacktestRunResponse(BaseModel):
    metrics: StrategyBacktestRead
    trades: List[StrategySimulatedTradeRead]
    equity_curve: List[Dict[str, Any]]


def strategy_backtest_read_from_row(row: "StrategyBacktest") -> StrategyBacktestRead:
    """Build API model including parsed equity_curve JSON."""
    curve: List[Dict[str, Any]] = []
    raw = row.equity_curve_json
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                curve = [c for c in parsed if isinstance(c, dict)]
        except json.JSONDecodeError:
            curve = []
    trp = getattr(row, "total_return_pct", None)
    return StrategyBacktestRead(
        id=row.id,
        strategy_id=row.strategy_id,
        total_trades=row.total_trades,
        win_rate=row.win_rate,
        average_profit=row.average_profit,
        max_drawdown=row.max_drawdown,
        total_return_pct=float(trp) if trp is not None else 0.0,
        equity_curve=curve,
        created_at=row.created_at,
    )
