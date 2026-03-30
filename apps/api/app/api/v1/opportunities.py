from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user_optional
from app.core.plan_access import has_feature
from app.db import get_db
from app.models import Opportunity, OpportunityStatus, User
from app.services.access.opportunity_serialization import serialize_opportunity
from app.services.auth.plan_access import resolve_effective_plan


router = APIRouter(prefix="/api/v1/opportunities", tags=["opportunities"])


def _opp_full_access(db: Session, user: User | None) -> bool:
    return has_feature(resolve_effective_plan(db, user), "opportunities_full")


@router.get("/top")
def get_top_opportunities(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
    limit: int = Query(default=20, ge=1, le=100),
    min_alpha: float = Query(default=0.0, ge=0.0, le=1.0),
    min_confidence: float = Query(default=0.0, ge=0.0, le=1.0),
) -> List[dict]:
    """
    Return highest-scoring real opportunities from the Opportunity table.

    Frontend uses this for "Top scanner opportunities". We map:
    - alpha_score -> total_score
    - opportunity_type -> type
    - token_symbol -> asset_symbol
    """
    eff_limit = limit if _opp_full_access(db, current_user) else min(limit, 12)
    q = (
        db.query(Opportunity)
        .filter(Opportunity.status == OpportunityStatus.ACTIVE.value)
        .filter(Opportunity.total_score >= min_alpha)
        .filter(Opportunity.confidence_score >= min_confidence)
        .order_by(Opportunity.total_score.desc(), Opportunity.confidence_score.desc())
        .limit(eff_limit)
    )
    rows = list(q.all())
    full = _opp_full_access(db, current_user)
    out: List[dict] = []
    for o in rows:
        base = {
            "id": o.id,
            "token_symbol": o.asset_symbol,
            "opportunity_type": o.type,
            "alpha_score": o.total_score,
            "confidence_score": o.confidence_score,
            "created_at": o.detected_at.isoformat()
            if o.detected_at
            else (
                o.created_at.isoformat()
                if getattr(o, "created_at", None)
                else None
            ),
        }
        if full:
            base["summary"] = o.summary
        out.append(base)
    return out


@router.get("")
def list_opportunities(
    type: Optional[str] = Query(
        default=None,
        description=(
            "(Deprecated) Filter by opportunity type (e.g. arbitrage). "
            "Use 'opportunity_type' instead."
        ),
    ),
    chain: Optional[str] = Query(
        default=None,
        description="Filter by chain (e.g. ethereum, solana).",
    ),
    min_score: Optional[float] = Query(
        default=None,
        description=(
            "(Deprecated) Minimum total_score threshold. "
            "Use 'minimum_score' instead."
        ),
    ),
    opportunity_type: Optional[str] = Query(
        default=None,
        description=(
            "Filter by opportunity type "
            "(e.g. arbitrage, miner, wallet, narrative, airdrop, project_discovery)."
        ),
    ),
    minimum_roi: Optional[float] = Query(
        default=None,
        description="Minimum estimated_roi_percent threshold (e.g. 50 for 50%).",
    ),
    minimum_score: Optional[float] = Query(
        default=None,
        description="Minimum total_score threshold (0–1 scale).",
    ),
    confidence_score: Optional[float] = Query(
        default=None,
        description="Minimum confidence_score threshold (0–1 scale).",
    ),
    liquidity_score: Optional[float] = Query(
        default=None,
        description="Minimum liquidity_score threshold (0–1 scale).",
    ),
    risk_level: Optional[str] = Query(
        default=None,
        description="Filter by risk_level (e.g. low, medium, high).",
    ),
    difficulty_level: Optional[str] = Query(
        default=None,
        description="Filter by difficulty_level (e.g. easy, medium, hard).",
    ),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> List[dict]:
    query = db.query(Opportunity).filter(
        Opportunity.status == OpportunityStatus.ACTIVE.value,
    )

    effective_type = opportunity_type or type
    effective_min_score = minimum_score if minimum_score is not None else min_score

    if effective_type:
        query = query.filter(Opportunity.type == effective_type)
    if chain:
        query = query.filter(Opportunity.chain == chain)
    if effective_min_score is not None:
        query = query.filter(Opportunity.total_score >= effective_min_score)
    if minimum_roi is not None:
        query = query.filter(
            Opportunity.estimated_roi_percent.isnot(None),
            Opportunity.estimated_roi_percent >= minimum_roi,
        )
    if confidence_score is not None:
        query = query.filter(Opportunity.confidence_score >= confidence_score)
    if liquidity_score is not None:
        query = query.filter(Opportunity.liquidity_score >= liquidity_score)
    if risk_level:
        query = query.filter(Opportunity.risk_level == risk_level)
    if difficulty_level:
        query = query.filter(Opportunity.difficulty_level == difficulty_level)

    cap = 500 if _opp_full_access(db, current_user) else 40
    rows = query.order_by(Opportunity.total_score.desc()).limit(cap).all()
    full = _opp_full_access(db, current_user)
    return [serialize_opportunity(o, full=full) for o in rows]


@router.get("/slug/{slug}")
def get_opportunity_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> dict:
    opportunity = (
        db.query(Opportunity).filter(Opportunity.slug == slug).first()
    )
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    full = _opp_full_access(db, current_user)
    return serialize_opportunity(opportunity, full=full)


@router.get("/{id}")
def get_opportunity(
    id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
) -> dict:
    opportunity = db.get(Opportunity, id)
    if opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    full = _opp_full_access(db, current_user)
    return serialize_opportunity(opportunity, full=full)
