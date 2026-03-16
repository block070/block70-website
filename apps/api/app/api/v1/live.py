"""
Live update API for homepage.

GET /api/v1/live/snapshot — returns a snapshot of latest signals and trending
tokens for near real-time homepage updates (e.g. polling every 30s).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.realtime.live_update_engine import LiveUpdateEngine

router = APIRouter(prefix="/api/v1/live", tags=["live"])


@router.get("/snapshot")
def get_live_snapshot(db: Session = Depends(get_db)) -> dict:
    """
    Return a point-in-time snapshot for homepage live updates: latest signal
    IDs and trending tokens. Frontend can poll this (e.g. every 30s) and
    refresh signals/trending when data changes.
    """
    engine = LiveUpdateEngine(signals_limit=20, trending_limit=10)
    snapshot = engine.get_snapshot(db)
    return {
        "generated_at": snapshot.generated_at,
        "signals_count": snapshot.signals_count,
        "signals_latest_ids": snapshot.signals_latest_ids,
        "trending_tokens": snapshot.trending_tokens,
        "version": snapshot.version,
    }
