from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.opportunity_db import OpportunityRead


class NarrativeDailyPoint(BaseModel):
    """One day of narrative attention (sum of opportunity total_score in that day)."""

    date: str = Field(description="UTC calendar date (YYYY-MM-DD).")
    attention: float = Field(description="Sum of total_score for matching opps that day.")


class NarrativeIntelligenceRow(BaseModel):
    """
    Aggregated narrative metrics derived from MarketNarrative + narrative-type opportunities.

    Opportunity linkage: narrative name must appear (case-insensitive) in opp title or summary.
    """

    id: int
    name: str
    description: Optional[str] = None
    trend_score: float
    created_at: Optional[str] = None

    attention: float = Field(
        description="Sum of total_score for matched opps with detected/created in the last 7d (UTC)."
    )
    sentiment: float = Field(
        description="Proxy −1..1: mean(upside_score - risk_score) over matched opps."
    )
    growth_rate: float = Field(
        description="(attn_7d - attn_prev_7d) / max(attn_prev_7d, ε)."
    )
    related_symbols: List[str] = Field(
        default_factory=list,
        description="Up to 8 asset_symbol values, top by max total_score.",
    )
    daily_series: List[NarrativeDailyPoint] = Field(
        default_factory=list,
        description="Last 14 UTC days of daily attention sums for this narrative.",
    )


class NarrativeIntelligenceDetail(NarrativeIntelligenceRow):
    opportunities: List[OpportunityRead] = Field(
        default_factory=list,
        description="Matched narrative opportunities, newest/highest score first.",
    )


class NarrativeIntelligenceListResponse(BaseModel):
    narratives: List[NarrativeIntelligenceRow]
    computed_at: datetime
