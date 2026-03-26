"""
Category directory from precomputed snapshots (avoids CoinGecko per-category fan-out).
"""

from __future__ import annotations

import json
import logging
import math
import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.category_snapshot import CategoryAggregateSnapshot

logger = logging.getLogger(__name__)

_EMPTY_SNAPSHOT_LOCK = threading.Lock()
_EMPTY_SNAPSHOT_LAST_RECOMPUTE_MONO = 0.0
_EMPTY_RECOMPUTE_COOLDOWN_SEC = 45.0


def _maybe_recompute_snapshots_if_empty(db: Session) -> None:
    """
    First visits often see no rows until the scheduler runs. Rebuild once from DB
    (junction + market_data) so GET /api/v1/categories is never permanently empty.
    """
    global _EMPTY_SNAPSHOT_LAST_RECOMPUTE_MONO
    with _EMPTY_SNAPSHOT_LOCK:
        now = time.monotonic()
        if now - _EMPTY_SNAPSHOT_LAST_RECOMPUTE_MONO < _EMPTY_RECOMPUTE_COOLDOWN_SEC:
            return
        _EMPTY_SNAPSHOT_LAST_RECOMPUTE_MONO = now
        try:
            from app.services.category_snapshot_service import recompute_category_snapshots

            recompute_category_snapshots(db)
        except Exception:
            logger.exception("lazy category snapshot recompute failed")
            try:
                db.rollback()
            except Exception:
                pass


def _ordered_snapshots(db: Session, order: str):
    q = db.query(CategoryAggregateSnapshot)
    if order == "market_cap_asc":
        return q.order_by(CategoryAggregateSnapshot.market_cap.asc())
    if order == "name_asc":
        return q.order_by(CategoryAggregateSnapshot.name.asc())
    if order == "name_desc":
        return q.order_by(CategoryAggregateSnapshot.name.desc())
    return q.order_by(CategoryAggregateSnapshot.market_cap.desc())

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])


def _sector_trend(
    avg_change_24h: Optional[float],
    vol_to_mcap: float,
    market_cap_change_24h: Optional[float],
) -> str:
    p = float(avg_change_24h) if avg_change_24h is not None and math.isfinite(avg_change_24h) else 0.0
    sector = (
        float(market_cap_change_24h)
        if market_cap_change_24h is not None and math.isfinite(market_cap_change_24h)
        else 0.0
    )
    liquidity_heat = 1.2 if vol_to_mcap > 0.08 else 0.4 if vol_to_mcap > 0.03 else -0.2
    score = p * 0.45 + sector * 0.25 + liquidity_heat
    if score > 0.35:
        return "bullish"
    if score < -0.35:
        return "bearish"
    return "neutral"


def _capital_flow(
    market_cap_change_24h: Optional[float],
    avg_change_24h: Optional[float],
) -> str:
    s = (
        float(market_cap_change_24h)
        if market_cap_change_24h is not None and math.isfinite(market_cap_change_24h)
        else 0.0
    )
    a = float(avg_change_24h) if avg_change_24h is not None and math.isfinite(avg_change_24h) else 0.0
    if s > 0.25 and a >= -2:
        return "in"
    if s < -0.25 and a <= 2:
        return "out"
    return "neutral"


def _snapshot_to_item(snap: CategoryAggregateSnapshot) -> Dict[str, Any]:
    mcap = max(1.0, float(snap.market_cap or 0.0))
    vol = float(snap.volume_24h or 0.0)
    vol_to_mcap = vol / mcap

    top: List[Dict[str, Any]] = []
    if snap.top_coins_json:
        try:
            top = json.loads(snap.top_coins_json)
        except json.JSONDecodeError:
            top = []

    top3 = []
    for row in top[:3]:
        ch = row.get("change24hPct")
        top3.append(
            {
                "slug": row.get("slug") or "",
                "name": row.get("name") or row.get("symbol") or "",
                "symbol": row.get("symbol") or "",
                "change24hPct": float(ch) if ch is not None and math.isfinite(float(ch)) else 0.0,
                "block70Score": int(row.get("block70Score") or 0),
            }
        )

    top_coins = [
        {"slug": row.get("slug") or "", "symbol": row.get("symbol") or row.get("name") or ""}
        for row in top[:5]
    ]

    avg_ch = snap.avg_change_24h
    trend = _sector_trend(avg_ch, vol_to_mcap, snap.market_cap_change_24h)
    capital_flow = _capital_flow(snap.market_cap_change_24h, avg_ch)

    return {
        "id": snap.category_slug,
        "name": snap.name,
        "market_cap": snap.market_cap,
        "market_cap_change_24h": snap.market_cap_change_24h,
        "volume_24h": snap.volume_24h,
        "top_coins": top_coins,
        "content": None,
        "avg_block70": snap.avg_block70,
        "avg_change_24h": avg_ch,
        "coin_count": snap.coin_count,
        "trend": trend,
        "capital_flow": capital_flow,
        "vol_to_mcap": vol_to_mcap,
        "top3": top3,
    }


@router.get("")
def list_category_directory(
    db: Session = Depends(get_db),
    order: str = Query("market_cap_desc", description="market_cap_desc, market_cap_asc, name_asc, name_desc"),
    limit: int = Query(100, ge=1, le=500),
    page: int = Query(1, ge=1, le=100),
) -> Dict[str, Any]:
    q = _ordered_snapshots(db, order)
    total = q.count()
    if total == 0:
        _maybe_recompute_snapshots_if_empty(db)
        q = _ordered_snapshots(db, order)
        total = q.count()

    offset = (page - 1) * limit
    rows = q.offset(offset).limit(limit).all()
    items = [_snapshot_to_item(r) for r in rows]
    return {"items": items, "total": total}


@router.get("/{slug}")
def get_category_directory_entry(
    slug: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    s = (slug or "").strip().lower()
    if not s:
        raise HTTPException(status_code=400, detail="Invalid slug")
    snap = (
        db.query(CategoryAggregateSnapshot)
        .filter(CategoryAggregateSnapshot.category_slug == s)
        .first()
    )
    if not snap:
        raise HTTPException(status_code=404, detail="Category snapshot not found")
    return _snapshot_to_item(snap)
