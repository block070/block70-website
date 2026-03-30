from __future__ import annotations

from app.models import Opportunity
from app.schemas.opportunity_db import OpportunityRead


def serialize_opportunity(o: Opportunity, *, full: bool) -> dict:
    data = OpportunityRead.model_validate(o).model_dump()
    if full:
        return data
    data["thesis"] = None
    data["raw_payload"] = None
    data["source_ref"] = None
    data["estimated_cost"] = None
    data["estimated_upside"] = None
    data["liquidity_score"] = None
    data["difficulty_score"] = None
    data["risk_score"] = None
    data["upside_score"] = None
    data["freshness_score"] = None
    data["accessibility_score"] = None
    return data
