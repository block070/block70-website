from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import BacktestResult


router = APIRouter(prefix="/api/v1/backtests", tags=["backtests"])


def _serialize_backtest(result: BacktestResult) -> Dict:
    return {
        "id": result.id,
        "opportunity_id": result.opportunity_id,
        "token_symbol": result.token_symbol,
        "price_at_detection": result.price_at_detection,
        "price_after_1h": result.price_after_1h,
        "price_after_24h": result.price_after_24h,
        "price_after_7d": result.price_after_7d,
        "roi_1h_percent": result.roi_1h_percent,
        "roi_24h_percent": result.roi_24h_percent,
        "roi_7d_percent": result.roi_7d_percent,
        "success_flag": result.success_flag,
        "created_at": result.created_at.isoformat(),
    }


@router.get("/{opportunity_id}")
def get_backtest_for_opportunity(
    opportunity_id: int = Path(..., description="ID of the opportunity"),
    db: Session = Depends(get_db),
) -> Dict:
    """
    Return the backtest result for a specific opportunity.
    """
    result = (
        db.query(BacktestResult)
        .filter(BacktestResult.opportunity_id == opportunity_id)
        .order_by(BacktestResult.created_at.desc())
        .first()
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Backtest result not found")
    return _serialize_backtest(result)


@router.get("/top")
def get_top_backtests(
    db: Session = Depends(get_db),
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of top backtests to return.",
    ),
) -> List[Dict]:
    """
    Return the top backtests ranked by 24h ROI, with success_flag information.
    """
    results = (
        db.query(BacktestResult)
        .filter(BacktestResult.roi_24h_percent.isnot(None))
        .order_by(BacktestResult.roi_24h_percent.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_backtest(r) for r in results]

