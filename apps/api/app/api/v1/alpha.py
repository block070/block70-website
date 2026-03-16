from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AlphaSnapshot, Opportunity
from app.schemas.opportunity_db import OpportunityRead
from app.services.scoring.alpha_ranking_engine import AlphaRankingEngine
from app.services.scoring.alpha_explanation import explain_alpha_for_opportunity


router = APIRouter(prefix="/api/v1/alpha", tags=["alpha"])


def _serialize_row(
    opp: Opportunity,
    alpha_score: float,
    rank_position: int,
    snapshot_type: str | None = None,
    snapshot_created_at: str | None = None,
) -> Dict:
    explanation = explain_alpha_for_opportunity(opp, alpha_score)
    return {
        "alpha_score": alpha_score,
        "rank_position": rank_position,
        "snapshot_type": snapshot_type,
        "snapshot_created_at": snapshot_created_at,
        "explanation": explanation,
        "opportunity": OpportunityRead.model_validate(opp, from_attributes=True),
    }


@router.get("/hourly")
def get_alpha_hourly(
    db: Session = Depends(get_db),
) -> List[Dict]:
    """
    Return the most recent hourly alpha snapshot (top ranked opportunities).
    """
    # Find the latest hourly snapshot timestamp.
    latest_ts = db.query(func.max(AlphaSnapshot.created_at)).filter(
        AlphaSnapshot.snapshot_type == "hourly"
    ).scalar()
    if latest_ts is None:
        return []

    rows = (
        db.query(AlphaSnapshot, Opportunity)
        .join(Opportunity, AlphaSnapshot.opportunity_id == Opportunity.id)
        .filter(
            AlphaSnapshot.snapshot_type == "hourly",
            AlphaSnapshot.created_at == latest_ts,
        )
        .order_by(AlphaSnapshot.rank_position.asc())
        .all()
    )

    return [
        _serialize_row(
            opp,
            snap.alpha_score,
            snap.rank_position,
            "hourly",
            snap.created_at.isoformat() if snap.created_at else None,
        )
        for snap, opp in rows
    ]


@router.get("/daily")
def get_alpha_daily(
    db: Session = Depends(get_db),
) -> List[Dict]:
    """
    Return the most recent daily alpha snapshot (top ranked opportunities).
    """
    latest_ts = db.query(func.max(AlphaSnapshot.created_at)).filter(
        AlphaSnapshot.snapshot_type == "daily"
    ).scalar()
    if latest_ts is None:
        return []

    rows = (
        db.query(AlphaSnapshot, Opportunity)
        .join(Opportunity, AlphaSnapshot.opportunity_id == Opportunity.id)
        .filter(
            AlphaSnapshot.snapshot_type == "daily",
            AlphaSnapshot.created_at == latest_ts,
        )
        .order_by(AlphaSnapshot.rank_position.asc())
        .all()
    )

    return [
        _serialize_row(
            opp,
            snap.alpha_score,
            snap.rank_position,
            "daily",
            snap.created_at.isoformat() if snap.created_at else None,
        )
        for snap, opp in rows
    ]


@router.get("/top")
def get_alpha_top(
    db: Session = Depends(get_db),
) -> List[Dict]:
    """
    Run the Alpha Ranking Engine live and return the current top-ranked
    opportunities by alpha_score (all types).
    """
    engine = AlphaRankingEngine()
    result = engine.rank(db, top_n=5)

    rows: List[Dict] = []
    for idx, opp in enumerate(result.top, start=1):
        alpha_score = engine._compute_alpha_score(opp)
        rows.append(_serialize_row(opp, alpha_score, idx, None, None))

    return rows

