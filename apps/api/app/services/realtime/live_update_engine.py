"""
Live Update Engine.

Updates signals, prices, and whale trades in near real-time for the homepage
and other feeds. Intended to be called periodically (e.g. every 30–60 seconds)
by a background job or API endpoint that pushes updates to connected clients,
or to refresh server-rendered homepage data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import Signal
from app.services.analysis.trending_signal_engine import (
    TrendingSignalEngine,
    TrendingSignalToken,
)


@dataclass
class LiveUpdateSnapshot:
    """
    A point-in-time snapshot of data suitable for homepage live updates.
    Can be serialized to JSON and sent to the frontend (e.g. via polling or WebSocket).
    """

    generated_at: str
    signals_count: int
    signals_latest_ids: List[int]
    trending_tokens: List[Dict[str, Any]]
    version: int = 1


class LiveUpdateEngine:
    """
    Produces near real-time snapshots of signals, trending tokens, and (when
    wired to price/wallet pipelines) price and whale trade updates.

    Usage:
    - Call get_snapshot(db) every 30–60s from a scheduler or API.
    - Frontend can poll GET /api/v1/live/snapshot or receive via WebSocket.
    """

    def __init__(
        self,
        *,
        signals_limit: int = 20,
        trending_limit: int = 10,
        trending_hours: float = 24.0,
    ) -> None:
        self.signals_limit = signals_limit
        self.trending_limit = trending_limit
        self.trending_hours = trending_hours
        self._trending_engine = TrendingSignalEngine(lookback_hours=trending_hours)

    def get_snapshot(self, db: Session) -> LiveUpdateSnapshot:
        """
        Build a snapshot of latest signals and trending tokens.
        Extend with price and whale trade data when those pipelines expose APIs.
        """
        now = datetime.now(timezone.utc)

        # Latest signal IDs (for "new since last fetch" detection on frontend)
        signals_rows = (
            db.query(Signal.id)
            .order_by(Signal.created_at.desc())
            .limit(self.signals_limit)
            .all()
        )
        signals_latest_ids = [r[0] for r in signals_rows]

        # Trending tokens
        since = now - timedelta(hours=self.trending_hours)
        trending: List[TrendingSignalToken] = self._trending_engine.get_trending(
            db, since=since, limit=self.trending_limit
        )
        trending_tokens = [
            {
                "token_symbol": t.token_symbol,
                "token_address": t.token_address,
                "chain": t.chain,
                "signal_count": t.signal_count,
                "avg_confidence_score": round(t.avg_confidence_score, 4),
                "avg_signal_strength": round(t.avg_signal_strength, 4),
                "latest_signal_at": t.latest_signal_at.isoformat()
                if t.latest_signal_at
                else None,
            }
            for t in trending
        ]

        return LiveUpdateSnapshot(
            generated_at=now.isoformat(),
            signals_count=len(signals_latest_ids),
            signals_latest_ids=signals_latest_ids,
            trending_tokens=trending_tokens,
        )
