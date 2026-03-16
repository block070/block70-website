from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class OpportunityBase(BaseModel):
    title: str
    slug: str
    type: str
    chain: Optional[str] = None
    status: str = "active"

    summary: Optional[str] = None
    thesis: Optional[str] = None

    asset_symbol: Optional[str] = None
    base_symbol: Optional[str] = None
    quote_symbol: Optional[str] = None

    source: Optional[str] = None
    source_ref: Optional[str] = None

    estimated_cost: Optional[float] = None
    estimated_upside: Optional[float] = None
    estimated_roi_percent: Optional[float] = None

    confidence_score: float = 0.0
    upside_score: float = 0.0
    freshness_score: float = 0.0
    liquidity_score: float = 0.0
    accessibility_score: float = 0.0
    risk_score: float = 0.0
    difficulty_score: float = 0.0
    total_score: float = 0.0

    risk_level: Optional[str] = None
    difficulty_level: Optional[str] = None

    detected_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityRead(OpportunityBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
    raw_payload: Optional[dict] = None


class OpportunitySignalBase(BaseModel):
    opportunity_id: Optional[int] = None
    signal_type: str
    signal_value: float
    signal_weight: float = 1.0
    confidence: float = 0.0
    notes: Optional[str] = None


class OpportunitySignalCreate(OpportunitySignalBase):
    pass


class OpportunitySignalRead(OpportunitySignalBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class OpportunityWithSignals(OpportunityRead):
    signals: List[OpportunitySignalRead] = []

