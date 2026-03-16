from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity
from app.services.ai.research_report_engine import (
    OpportunityResearchReportEngine,
)


router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


def _serialize_report(report) -> Dict:
    return {
        "id": report.id,
        "opportunity_id": report.opportunity_id,
        "report_content": report.report_content,
        "project_overview": report.project_overview,
        "signal_analysis": report.signal_analysis,
        "risk_factors": report.risk_factors,
        "potential_upside": report.potential_upside,
        "market_narrative": report.market_narrative,
        "created_at": report.created_at.isoformat(),
    }


@router.get("/{opportunity_id}")
def get_research_report_for_opportunity(
    opportunity_id: int = Path(..., description="ID of the opportunity"),
    db: Session = Depends(get_db),
) -> Dict:
    """
    Return a long-form research report for a specific opportunity.

    If a report does not yet exist, this endpoint will generate one on
    demand via the research report engine and cache it in the database.
    """
    opportunity = (
        db.query(Opportunity)
        .filter(Opportunity.id == opportunity_id)
        .first()
    )
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    engine = OpportunityResearchReportEngine()
    report = engine.get_or_create_report(db, opportunity)
    return _serialize_report(report)

