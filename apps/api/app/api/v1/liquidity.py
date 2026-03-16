from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import LiquidityPool, RadarSignal


router = APIRouter(prefix="/api/v1/liquidity", tags=["liquidity"])


@router.get("/top-pools")
def get_top_pools(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Return top pools by liquidity_usd, descending.
    """
    rows = (
        db.query(LiquidityPool)
        .order_by(LiquidityPool.liquidity_usd.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": p.id,
            "dex": p.dex,
            "pair": p.pair,
            "token_a": p.token_a,
            "token_b": p.token_b,
            "liquidity_usd": p.liquidity_usd,
            "volume_24h": p.volume_24h,
            "fee_percent": p.fee_percent,
            "updated_at": p.updated_at.isoformat(),
        }
        for p in rows
    ]


@router.get("/changes")
def get_liquidity_changes(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Return recent liquidity-related radar signals: liquidity_increase,
    liquidity_drop, volume_spike.
    """
    rows = (
        db.query(RadarSignal)
        .filter(
            RadarSignal.signal_type.in_(
                ["liquidity_increase", "liquidity_drop", "volume_spike"]
            )
        )
        .order_by(RadarSignal.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "signal_type": s.signal_type,
            "token_symbol": s.token_symbol,
            "chain": s.chain,
            "signal_strength": s.signal_strength,
            "confidence_score": s.confidence_score,
            "source": s.source,
            "metadata": s.metadata_json,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in rows
    ]
