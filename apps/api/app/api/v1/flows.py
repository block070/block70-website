from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Header, Path, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CapitalFlow
from app.services.flows import CapitalFlowEngine


router = APIRouter(prefix="/api/v1/flows", tags=["flows"])


def _subscriber_enhanced(x_block70_plan: str | None) -> bool:
    if not x_block70_plan:
        return False
    return x_block70_plan.strip().lower() in ("pro", "elite", "admin")


def _flow_to_dict(f: CapitalFlow) -> dict:
    return {
        "id": f.id,
        "source_asset": f.source_asset,
        "destination_asset": f.destination_asset,
        "amount": f.amount,
        "chain": f.chain,
        "timestamp": f.timestamp.isoformat() if f.timestamp else None,
    }


@router.get("")
def list_flows(
    db: Session = Depends(get_db),
    chain: str | None = Query(default=None, description="Filter by chain"),
    hours: int = Query(default=168, ge=1, le=720, description="Look-back hours"),
    limit: int = Query(default=100, ge=1, le=500),
) -> List[dict]:
    """List capital flows with optional chain and time filter."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    engine = CapitalFlowEngine()
    flows = engine.list_flows(db, chain=chain, since=since, limit=limit)
    return [_flow_to_dict(f) for f in flows]


@router.get("/trending")
def get_trending_flows(
    db: Session = Depends(get_db),
    hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=20, ge=1, le=100),
    chain: str | None = Query(default=None, description="Filter by chain"),
) -> List[dict]:
    """Return trending capital flows (aggregated by source/destination)."""
    engine = CapitalFlowEngine()
    return engine.trending(db, hours=hours, limit=limit, chain=chain)


@router.get("/summary")
def get_flows_summary(
    db: Session = Depends(get_db),
    hours: int = Query(default=24, ge=1, le=720, description="Look-back hours"),
    chain: str | None = Query(default=None, description="Filter by chain"),
    x_block70_plan: str | None = Header(default=None, alias="X-Block70-Plan"),
) -> dict:
    """Macro snapshot: volume, chain/category/destination breakdowns, hot edges."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    engine = CapitalFlowEngine()
    enhanced = _subscriber_enhanced(x_block70_plan)
    if enhanced:
        out = engine.summary(
            db,
            hours=hours,
            chain=chain,
            limit_destinations=40,
            limit_categories=32,
            limit_edges=72,
            category_source_limit=320,
        )
        recent_limit = 48
    else:
        out = engine.summary(db, hours=hours, chain=chain)
        recent_limit = 20
    out["recent"] = [
        _flow_to_dict(f)
        for f in engine.list_flows(db, chain=chain, since=since, limit=recent_limit)
    ]
    base_note = (
        "Category labels map from Block70 coin metadata when symbols match; "
        "unmatched assets count as Unknown. Not exhaustive on-chain coverage."
    )
    if enhanced:
        out["data_tier"] = "enhanced"
        out["disclaimer"] = (
            base_note + " Subscriber view uses wider aggregates and more recent legs for near–live desk use."
        )
    else:
        out["data_tier"] = "standard"
        out["disclaimer"] = base_note
    return out


@router.get("/{token}")
def get_flows_for_token(
    token: str = Path(..., description="Token symbol"),
    db: Session = Depends(get_db),
    hours: int = Query(default=168, ge=1, le=720),
    limit: int = Query(default=50, ge=1, le=200),
) -> List[dict]:
    """Return capital flows where the token is source or destination."""
    engine = CapitalFlowEngine()
    flows = engine.flows_for_token(db, token, hours=hours, limit=limit)
    return [_flow_to_dict(f) for f in flows]
