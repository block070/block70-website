from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict


class PortfolioWalletRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    portfolio_id: int
    wallet_address: str
    chain: str
    created_at: datetime


class PortfolioTokenBalanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    portfolio_id: int
    token_symbol: str
    token_address: str
    chain: str
    balance: float
    value_usd: float
    updated_at: datetime


class PortfolioTransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    portfolio_id: int
    token_symbol: str
    transaction_type: str
    amount: float
    value_usd: float
    tx_hash: str
    timestamp: datetime


class PortfolioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    portfolio_name: str
    total_value_usd: float
    total_profit_loss: float
    created_at: datetime
    updated_at: datetime


class AddWalletPayload(BaseModel):
    wallet_address: str
    chain: str


class PortfolioMetricsRead(BaseModel):
    total_value_usd: float
    total_profit_loss: float
    best_performing: List[dict]
    worst_performing: List[dict]
