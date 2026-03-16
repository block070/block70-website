"""
Trending Signal Engine.

Detects tokens receiving the most signals. Used to power /signals/trending
and leaderboard. Can be updated periodically (e.g. every 10 minutes).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Signal


@dataclass
class TrendingSignalToken:
    """Token ranked by signal activity for trending/leaderboard."""

    token_symbol: Optional[str]
    token_address: Optional[str]
    chain: Optional[str]
    signal_count: int
    avg_confidence_score: float
    avg_signal_strength: float
    trend_direction: str  # "up" | "neutral" | "down" (vs prior window)
    latest_signal_at: Optional[datetime]


class TrendingSignalEngine:
    """
    Aggregates signals by token (symbol/address + chain) and ranks by
    signal count, confidence, and strength. Trend direction is computed
    by comparing current window to a prior window.
    """

    def __init__(
        self,
        *,
        lookback_hours: float = 24.0,
        prior_window_hours: float = 24.0,
        min_signals: int = 1,
    ) -> None:
        self.lookback_hours = lookback_hours
        self.prior_window_hours = prior_window_hours
        self.min_signals = min_signals

    def get_trending(
        self,
        db: Session,
        since: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[TrendingSignalToken]:
        """
        Return tokens ranked by signal activity in the lookback window.
        trend_direction is "neutral" in this base implementation; extend
        with prior-window counts for up/down.
        """
        if since is None:
            since = datetime.now(timezone.utc) - timedelta(hours=self.lookback_hours)

        # Group by (token_symbol, token_address, chain); aggregate count, avg confidence, avg strength, max created_at
        subq = (
            db.query(
                Signal.token_symbol,
                Signal.token_address,
                Signal.chain,
                func.count(Signal.id).label("signal_count"),
                func.avg(Signal.confidence_score).label("avg_confidence"),
                func.avg(Signal.signal_strength).label("avg_strength"),
                func.max(Signal.created_at).label("latest_at"),
            )
            .filter(Signal.created_at >= since)
            .filter(
                (Signal.token_symbol.isnot(None)) | (Signal.token_address.isnot(None))
            )
            .group_by(Signal.token_symbol, Signal.token_address, Signal.chain)
            .having(func.count(Signal.id) >= self.min_signals)
            .subquery()
        )

        # Order by signal_count desc, then avg_confidence desc
        rows = (
            db.query(subq)
            .order_by(
                subq.c.signal_count.desc(),
                subq.c.avg_confidence.desc(),
            )
            .limit(limit)
            .all()
        )

        return [
            TrendingSignalToken(
                token_symbol=row.token_symbol,
                token_address=row.token_address,
                chain=row.chain,
                signal_count=row.signal_count,
                avg_confidence_score=float(row.avg_confidence or 0.0),
                avg_signal_strength=float(row.avg_strength or 0.0),
                trend_direction="neutral",
                latest_signal_at=row.latest_at,
            )
            for row in rows
        ]

    def get_leaderboard(
        self,
        db: Session,
        since: Optional[datetime] = None,
        limit: int = 50,
        sort_by: str = "signal_strength",  # signal_strength | signal_count | confidence_score
    ) -> List[TrendingSignalToken]:
        """
        Return tokens ranked for leaderboard. sort_by: signal_strength (avg),
        signal_count, or confidence_score (avg).
        """
        trending = self.get_trending(db, since=since, limit=limit * 2)
        if sort_by == "signal_count":
            trending.sort(key=lambda t: (-t.signal_count, -t.avg_confidence_score))
        elif sort_by == "confidence_score":
            trending.sort(key=lambda t: (-t.avg_confidence_score, -t.signal_count))
        else:
            trending.sort(key=lambda t: (-t.avg_signal_strength, -t.signal_count))
        return trending[:limit]
