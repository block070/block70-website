from __future__ import annotations

from typing import Any, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, AICopilotInsight
from app.schemas.copilot import CopilotInsightRead, PortfolioInsightSection, OpportunityItem
from app.services.ai.copilot_engine import CopilotEngine


router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])


def _insight_to_read(i: AICopilotInsight) -> dict[str, Any]:
    return {
        "id": i.id,
        "user_id": i.user_id,
        "insight_type": i.insight_type,
        "title": i.title,
        "summary": i.summary,
        "confidence_score": float(i.confidence_score or 0),
        "related_tokens": i.related_tokens or [],
        "suggested_actions": i.suggested_actions or [],
        "created_at": i.created_at,
    }


@router.get("/insights", response_model=List[dict])
def get_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    insight_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    """GET /api/v1/copilot/insights — list Copilot insights for the current user."""
    q = (
        db.query(AICopilotInsight)
        .filter(AICopilotInsight.user_id == current_user.id)
        .order_by(AICopilotInsight.created_at.desc())
    )
    if insight_type:
        q = q.filter(AICopilotInsight.insight_type == insight_type)
    rows = q.offset(offset).limit(limit).all()
    return [_insight_to_read(r) for r in rows]


@router.get("/portfolio", response_model=dict)
def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GET /api/v1/copilot/portfolio — portfolio analysis (risk, opportunities, whale overlap)."""
    engine = CopilotEngine()
    analysis = engine.get_portfolio_analysis(db, current_user.id)
    return {
        "risk_concentrations": [
            {
                "token_symbol": r.token_symbol,
                "allocation_pct": r.allocation_pct,
                "value_usd": r.value_usd,
                "risk_level": r.risk_level,
            }
            for r in analysis.risk_concentrations
        ],
        "opportunities": [
            {
                "token_symbol": o.token_symbol,
                "reason": o.reason,
                "confidence": o.confidence,
            }
            for o in analysis.opportunities
        ],
        "whale_overlaps": [
            {
                "token_symbol": w.token_symbol,
                "overlap_type": w.overlap_type,
                "description": w.description,
            }
            for w in analysis.whale_overlaps
        ],
        "portfolio_tokens": analysis.portfolio_tokens,
        "total_value_usd": analysis.total_value_usd,
    }


@router.get("/opportunities", response_model=List[dict])
def get_opportunities(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=50),
    min_confidence: float = Query(default=0.3, ge=0.0, le=1.0),
):
    """GET /api/v1/copilot/opportunities — detected opportunities (signals, flows, radar)."""
    engine = CopilotEngine()
    opportunities = engine.get_opportunities(db, limit=limit, min_confidence=min_confidence)
    return [
        {
            "token_symbol": o.token_symbol,
            "source": o.source,
            "title": o.title,
            "summary": o.summary,
            "confidence": o.confidence,
            "risk_level": o.risk_level,
            "entry_note": o.entry_note,
            "exit_note": o.exit_note,
        }
        for o in opportunities
    ]


@router.post("/insights/generate", response_model=List[dict])
def generate_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    max_insights: int = Query(default=25, ge=1, le=50),
    min_confidence: float = Query(default=0.35, ge=0.0, le=1.0),
):
    """Generate and persist Copilot insights for the current user."""
    engine = CopilotEngine()
    insights = engine.generate_insights(
        db,
        current_user.id,
        max_insights=max_insights,
        min_confidence=min_confidence,
    )
    return [_insight_to_read(i) for i in insights]
