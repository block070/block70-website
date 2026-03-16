from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.scoring.radar_event_engine import RadarEvent, RadarEventEngine
from app.services.radar import MarketRadarEngine


router = APIRouter(prefix="/api/v1/radar", tags=["radar"])


def _serialize_event(ev: RadarEvent) -> Dict:
    return {
        "token_symbol": ev.token_symbol,
        "chain": ev.chain,
        "event_score": ev.event_score,
        "signal_count": ev.signal_count,
        "avg_signal_strength": ev.avg_signal_strength,
        "avg_confidence_score": ev.avg_confidence_score,
        "recency_score": ev.recency_score,
        "latest_signal_at": ev.latest_signal_at.isoformat(),
        "signal_types": ev.signal_types,
    }


@router.get("")
def list_radar(
    db: Session = Depends(get_db),
    hours: int = Query(default=24, ge=1, le=72),
    min_event_score: float = Query(default=0.4, ge=0.0, le=1.0),
    include_persisted: bool = Query(default=True, description="Include persisted RadarEvent records"),
) -> List[Dict]:
    """
    Return radar data: aggregated events from signals and optionally
    persisted anomaly events (volume spikes, liquidity, breakouts).
    """
    result: List[Dict] = []
    if include_persisted:
        radar_engine = MarketRadarEngine()
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        persisted = radar_engine.list_events(db, since=since, limit=50)
        for ev in persisted:
            result.append({
                "token_symbol": ev.token_symbol,
                "event_type": ev.event_type,
                "severity_score": ev.severity_score,
                "description": ev.description,
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
            })
    engine = RadarEventEngine()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    events = engine.aggregate(db, since=since, min_event_score=min_event_score)
    result.extend([_serialize_event(ev) for ev in events])
    # Dedupe by token; prefer persisted then aggregated
    seen = set()
    out = []
    for r in result:
        key = r.get("token_symbol") or ""
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out[:50]


@router.get("/events")
def list_radar_events(
    db: Session = Depends(get_db),
    hours: int = Query(
        default=24,
        ge=1,
        le=72,
        description="Look-back window in hours for radar signals.",
    ),
    min_event_score: float = Query(
        default=0.4,
        ge=0.0,
        le=1.0,
        description="Minimum radar event score threshold.",
    ),
) -> List[Dict]:
    """
    Return radar events aggregated over the last `hours` hours.
    """
    engine = RadarEventEngine()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    events = engine.aggregate(db, since=since, min_event_score=min_event_score)
    return [_serialize_event(ev) for ev in events]


@router.get("/{token}")
def get_radar_for_token(
    token: str = Path(..., description="Token symbol"),
    db: Session = Depends(get_db),
    hours: int = Query(default=24, ge=1, le=168),
    min_event_score: float = Query(default=0.2, ge=0.0, le=1.0),
) -> List[Dict]:
    """Return radar events for a specific token (alias for /events/{token})."""
    return get_radar_events_for_token(token=token, db=db, hours=hours, min_event_score=min_event_score)


@router.get("/events/{token}")
def get_radar_events_for_token(
    token: str = Path(..., description="Token symbol to fetch radar events for."),
    db: Session = Depends(get_db),
    hours: int = Query(
        default=24,
        ge=1,
        le=168,
        description="Look-back window in hours for radar signals.",
    ),
    min_event_score: float = Query(
        default=0.2,
        ge=0.0,
        le=1.0,
        description="Minimum radar event score threshold.",
    ),
) -> List[Dict]:
    """
    Return radar events for a specific token_symbol.
    """
    engine = RadarEventEngine()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    events = engine.aggregate(db, since=since, min_event_score=min_event_score)
    filtered = [ev for ev in events if ev.token_symbol and ev.token_symbol.lower() == token.lower()]
    result = [_serialize_event(ev) for ev in filtered]
    radar_engine = MarketRadarEngine()
    persisted = radar_engine.events_for_token(db, token, hours=hours, limit=20)
    for ev in persisted:
        result.insert(0, {
            "token_symbol": ev.token_symbol,
            "event_type": ev.event_type,
            "severity_score": ev.severity_score,
            "description": ev.description,
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
        })
    return result


@router.get("/top")
def get_top_radar_events(
    db: Session = Depends(get_db),
    hours: int = Query(
        default=24,
        ge=1,
        le=72,
        description="Look-back window in hours for radar signals.",
    ),
    min_event_score: float = Query(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum radar event score threshold.",
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of radar events to return.",
    ),
) -> List[Dict]:
    """
    Return the highest-scoring radar events in the given look-back window.
    """
    engine = RadarEventEngine()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    events = engine.aggregate(db, since=since, min_event_score=min_event_score)
    top_events = events[:limit]
    return [_serialize_event(ev) for ev in top_events]

