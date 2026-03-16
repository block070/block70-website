from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity
from app.services.ai.opportunity_analysis_service import (
    OpportunityAnalysisService,
)


router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


def _serialize_analysis(analysis) -> Dict:
    return {
        "id": analysis.id,
        "opportunity_id": analysis.opportunity_id,
        "analysis_summary": analysis.analysis_summary,
        "key_factors": analysis.key_factors,
        "risk_assessment": analysis.risk_assessment,
        "confidence_explanation": analysis.confidence_explanation,
        "trade_strategy": analysis.trade_strategy,
        "created_at": analysis.created_at.isoformat(),
    }


@router.get("/{opportunity_id}")
def get_ai_analysis_for_opportunity(
    opportunity_id: int = Path(..., description="ID of the opportunity"),
    db: Session = Depends(get_db),
) -> Dict:
    """
    Return the AI-generated analysis for a specific opportunity.

    If no analysis exists yet, this endpoint will generate one on demand
    using the configured LLM and persist it for future requests.
    """
    opportunity = (
        db.query(Opportunity)
        .filter(Opportunity.id == opportunity_id)
        .first()
    )
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    service = OpportunityAnalysisService()
    analysis = service.get_or_create_analysis(db, opportunity)
    return _serialize_analysis(analysis)

