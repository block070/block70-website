from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import StreamEvent


router = APIRouter(prefix="/api/v1/events", tags=["events"])


@router.get("/recent")
def get_recent_events(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Return the most recent StreamEvents, ordered by created_at descending.
    """
    rows: List[StreamEvent] = (
        db.query(StreamEvent)
        .order_by(StreamEvent.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": ev.id,
            "event_type": ev.event_type,
            "source": ev.source,
            "token_symbol": ev.token_symbol,
            "chain": ev.chain,
            "payload": ev.payload_json,
            "created_at": ev.created_at.isoformat(),
        }
        for ev in rows
    ]


@router.get("/stats")
def get_event_stats(
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Return basic metrics about recent StreamEvent activity.

    Metrics include:
    - total_events: total events in the window
    - by_type: counts grouped by event_type
    - by_source: counts grouped by source
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)

    base_query = db.query(StreamEvent).filter(StreamEvent.created_at >= since)

    total_events = base_query.count()

    by_type = (
        db.query(StreamEvent.event_type, func.count(StreamEvent.id))
        .filter(StreamEvent.created_at >= since)
        .group_by(StreamEvent.event_type)
        .all()
    )
    by_source = (
        db.query(StreamEvent.source, func.count(StreamEvent.id))
        .filter(StreamEvent.created_at >= since)
        .group_by(StreamEvent.source)
        .all()
    )

    return {
        "window_hours": hours,
        "since": since.isoformat(),
        "until": now.isoformat(),
        "total_events": total_events,
        "by_type": {etype: count for etype, count in by_type},
        "by_source": {src: count for src, count in by_source},
    }

