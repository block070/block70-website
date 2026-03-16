from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


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


class StrategyBacktestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    strategy_id: int
    total_trades: int
    win_rate: float
    average_profit: float
    max_drawdown: float
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
