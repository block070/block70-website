from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict


class OpportunityScores(BaseModel):
    upside_score: float
    confidence_score: float
    freshness_score: float
    liquidity_score: float
    accessibility_score: float
    risk_score: float
    difficulty_score: float
    total_score: float

    risk_level: str
    difficulty_level: str


class OpportunityBase(BaseModel):
    type: str
    title: str
    description: str
    source: str
    dedup_key: str

    scores: OpportunityScores


class OpportunityCreate(OpportunityBase):
    detected_at: datetime
    last_seen_at: datetime
    expires_at: Optional[datetime] = None
    status: str = "active"
    raw_payload: Optional[dict] = None


class OpportunitySignalBase(BaseModel):
    source: str
    signal_type: str
    external_id: Optional[str]
    payload: dict
    detected_at: datetime
    dedup_key: str


class OpportunitySignalCreate(OpportunitySignalBase):
    opportunity_id: Optional[int] = None


class OpportunitySignalRead(OpportunitySignalBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class OpportunityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    description: str
    source: str
    dedup_key: str

    upside_score: float
    confidence_score: float
    freshness_score: float
    liquidity_score: float
    accessibility_score: float
    risk_score: float
    difficulty_score: float
    total_score: float

    risk_level: str
    difficulty_level: str

    detected_at: datetime
    last_seen_at: datetime
    expires_at: Optional[datetime]
    status: str

    raw_payload: Optional[dict] = None


class OpportunityListResponse(BaseModel):
    items: List[OpportunityRead]
    total: int

