from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class CopilotInsightRead(BaseModel):
    id: int
    user_id: int
    insight_type: str
    title: str
    summary: Optional[str] = None
    confidence_score: float = 0.0
    related_tokens: Optional[List[str]] = None
    suggested_actions: Optional[List[Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PortfolioInsightSection(BaseModel):
    risk_concentrations: List[Any] = Field(default_factory=list)
    opportunities: List[Any] = Field(default_factory=list)
    whale_overlaps: List[Any] = Field(default_factory=list)
    portfolio_tokens: List[str] = Field(default_factory=list)
    total_value_usd: float = 0.0


class OpportunityItem(BaseModel):
    token_symbol: str
    source: str
    title: str
    summary: str
    confidence: float
