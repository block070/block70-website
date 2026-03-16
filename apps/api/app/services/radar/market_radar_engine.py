"""
Market radar engine: detect anomalies (volume spikes, liquidity changes, price breakouts).
Persists RadarEvent records for the radar dashboard.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import RadarEvent


class MarketRadarEngine:
    """
    Detects and persists market anomalies. Detectors can push
    volume_spike, liquidity_change, price_breakout, etc.
    """

    def emit(
        self,
        db: Session,
        *,
        token_symbol: str,
        event_type: str,
        severity_score: float,
        description: Optional[str] = None,
    ) -> RadarEvent:
        """Record a radar anomaly event."""
        ev = RadarEvent(
            token_symbol=token_symbol,
            event_type=event_type,
            severity_score=severity_score,
            description=description,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)
        return ev

    def list_events(
        self,
        db: Session,
        *,
        token_symbol: Optional[str] = None,
        event_type: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[RadarEvent]:
        """List radar events with optional filters."""
        q = db.query(RadarEvent)
        if token_symbol:
            q = q.filter(RadarEvent.token_symbol == token_symbol)
        if event_type:
            q = q.filter(RadarEvent.event_type == event_type)
        if since:
            q = q.filter(RadarEvent.created_at >= since)
        q = q.order_by(RadarEvent.created_at.desc()).limit(limit)
        return list(q.all())

    def events_for_token(
        self,
        db: Session,
        token: str,
        *,
        hours: int = 168,
        limit: int = 50,
    ) -> List[RadarEvent]:
        """Return radar events for a given token."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        return self.list_events(
            db,
            token_symbol=token.upper(),
            since=since,
            limit=limit,
        )
