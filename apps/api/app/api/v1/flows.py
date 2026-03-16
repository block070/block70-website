from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CapitalFlow
from app.services.flows import CapitalFlowEngine


router = APIRouter(prefix="/api/v1/flows", tags=["flows"])


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
) -> List[dict]:
    """Return trending capital flows (aggregated by source/destination)."""
    engine = CapitalFlowEngine()
    return engine.trending(db, hours=hours, limit=limit)


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
