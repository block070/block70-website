"""
AI trend detection: emerging trends from signal clusters, capital flows,
social activity.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import CapitalFlow, RadarSignal, Signal


@dataclass
class DetectedTrend:
    """An emerging trend."""
    trend_type: str
    token_symbol: str | None
    description: str
    strength: float
    signal_count: int


class TrendDetector:
    """
    Detect emerging trends using:
    - signal clusters (same token, many signals)
    - capital flows (inflows/outflows by token)
    - radar/social (radar signals as proxy for social/volume activity)
    """

    def from_signal_clusters(
        self,
        db: Session,
        *,
        hours: int = 24,
        min_signals: int = 5,
        limit: int = 10,
    ) -> List[DetectedTrend]:
        """Tokens with clustering signals (high activity)."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        q = (
            db.query(
                Signal.token_symbol,
                func.count(Signal.id).label("cnt"),
                func.avg(Signal.confidence_score).label("avg_conf"),
            )
            .filter(Signal.created_at >= since)
            .filter(Signal.token_symbol.isnot(None))
            .group_by(Signal.token_symbol)
            .having(func.count(Signal.id) >= min_signals)
            .order_by(func.count(Signal.id).desc())
            .limit(limit)
        )
        rows = q.all()
        return [
            DetectedTrend(
                trend_type="signal_cluster",
                token_symbol=r.token_symbol,
                description=f"{r.cnt} signals in {hours}h for {r.token_symbol}",
                strength=float(r.avg_conf or 0),
                signal_count=r.cnt,
            )
            for r in rows
        ]

    def from_capital_flows(
        self,
        db: Session,
        *,
        hours: int = 24,
        limit: int = 10,
    ) -> List[DetectedTrend]:
        """Tokens with large inflows (destination_asset) or outflows (source_asset)."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        # Inflows: sum amount where token is destination
        q_in = (
            db.query(
                CapitalFlow.destination_asset.label("token"),
                func.sum(CapitalFlow.amount).label("total"),
                func.count(CapitalFlow.id).label("cnt"),
            )
            .filter(CapitalFlow.timestamp >= since)
            .group_by(CapitalFlow.destination_asset)
            .order_by(func.sum(CapitalFlow.amount).desc())
            .limit(limit)
        )
        out = []
        for r in q_in.all():
            out.append(
                DetectedTrend(
                    trend_type="capital_inflow",
                    token_symbol=r.token,
                    description=f"Capital inflow to {r.token}: {r.total:.0f} over {r.cnt} flows",
                    strength=min(1.0, float(r.total or 0) / 1e9),
                    signal_count=r.cnt,
                ),
            )
        return out

    def from_radar(
        self,
        db: Session,
        *,
        hours: int = 24,
        limit: int = 10,
    ) -> List[DetectedTrend]:
        """Tokens with recent radar activity (volume/social proxy)."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        q = (
            db.query(
                RadarSignal.token_symbol,
                func.count(RadarSignal.id).label("cnt"),
                func.avg(RadarSignal.signal_strength).label("avg_str"),
            )
            .filter(RadarSignal.created_at >= since)
            .filter(RadarSignal.token_symbol.isnot(None))
            .group_by(RadarSignal.token_symbol)
            .order_by(func.count(RadarSignal.id).desc())
            .limit(limit)
        )
        rows = q.all()
        return [
            DetectedTrend(
                trend_type="radar_activity",
                token_symbol=r.token_symbol,
                description=f"Radar activity for {r.token_symbol}: {r.cnt} signals",
                strength=float(r.avg_str or 0),
                signal_count=r.cnt,
            )
            for r in rows
        ]

    def run_all(
        self,
        db: Session,
        *,
        hours: int = 24,
        limit_per_type: int = 5,
    ) -> List[DetectedTrend]:
        """Run all trend detectors."""
        out: List[DetectedTrend] = []
        out.extend(self.from_signal_clusters(db, hours=hours, limit=limit_per_type))
        out.extend(self.from_capital_flows(db, hours=hours, limit=limit_per_type))
        out.extend(self.from_radar(db, hours=hours, limit=limit_per_type))
        return out
