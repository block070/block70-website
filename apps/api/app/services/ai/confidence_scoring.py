"""
AI confidence scoring: combine signal strength, wallet reputation, market volume
into a single confidence score for insights.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import CapitalFlow, RadarSignal, Signal, WalletProfile


@dataclass
class ConfidenceInputs:
    """Inputs used to compute confidence."""
    signal_strength_avg: float = 0.0
    signal_count: int = 0
    wallet_reputation_avg: float = 0.0
    wallet_count: int = 0
    flow_volume_usd: float = 0.0
    flow_count: int = 0
    radar_severity_avg: float = 0.0
    radar_count: int = 0


class ConfidenceScoring:
    """
    Calculate confidence score in [0, 1] from:
    - signal strength and count
    - wallet reputation (win rate / ROI)
    - capital flow volume
    - radar severity
    """

    def __init__(
        self,
        *,
        weight_signal: float = 0.3,
        weight_wallet: float = 0.25,
        weight_flow: float = 0.25,
        weight_radar: float = 0.2,
    ) -> None:
        self._weight_signal = weight_signal
        self._weight_wallet = weight_wallet
        self._weight_flow = weight_flow
        self._weight_radar = weight_radar

    def score(self, inputs: ConfidenceInputs) -> float:
        """Produce a single confidence score in [0, 1]."""
        s = min(1.0, inputs.signal_strength_avg) * self._weight_signal
        if inputs.signal_count >= 3:
            s += 0.1
        w = min(1.0, inputs.wallet_reputation_avg) * self._weight_wallet
        if inputs.wallet_count >= 2:
            w += 0.05
        f = min(1.0, inputs.flow_volume_usd / 1e9 if inputs.flow_volume_usd else 0) * self._weight_flow
        if inputs.flow_count >= 5:
            f += 0.05
        r = min(1.0, inputs.radar_severity_avg) * self._weight_radar
        if inputs.radar_count >= 2:
            r += 0.05
        return min(1.0, s + w + f + r)

    def from_signals(self, db: Session, token_symbol: str | None = None) -> ConfidenceInputs:
        """Aggregate signal-based inputs for a token (or global)."""
        q = db.query(Signal).filter(Signal.confidence_score.isnot(None))
        if token_symbol:
            q = q.filter(Signal.token_symbol == token_symbol)
        signals = q.limit(100).all()
        if not signals:
            return ConfidenceInputs()
        strength = sum(float(s.confidence_score or 0) for s in signals) / len(signals)
        return ConfidenceInputs(
            signal_strength_avg=strength,
            signal_count=len(signals),
        )

    def from_wallets(self, db: Session, addresses: List[str] | None = None) -> float:
        """Average wallet reputation (win_rate) for given addresses or top profiles."""
        if addresses:
            profiles = db.query(WalletProfile).filter(
                WalletProfile.wallet_address.in_(addresses),
            ).all()
        else:
            profiles = db.query(WalletProfile).order_by(
                WalletProfile.win_rate.desc(),
            ).limit(20).all()
        if not profiles:
            return 0.0
        return sum(p.win_rate or 0 for p in profiles) / len(profiles)

    def from_flows(self, db: Session, token: str | None = None) -> tuple[float, int]:
        """Total flow volume and count (optionally for token)."""
        from sqlalchemy import func
        q = db.query(
            func.coalesce(func.sum(CapitalFlow.amount), 0).label("total"),
            func.count(CapitalFlow.id).label("cnt"),
        )
        if token:
            q = q.filter(
                (CapitalFlow.source_asset == token) | (CapitalFlow.destination_asset == token),
            )
        row = q.first()
        return float(row.total or 0), int(row.cnt or 0)

    def from_radar(self, db: Session, token_symbol: str | None = None) -> tuple[float, int]:
        """Average radar severity and count."""
        from app.models import RadarEvent
        q = db.query(RadarEvent)
        if token_symbol:
            q = q.filter(RadarEvent.token_symbol == token_symbol)
        events = q.limit(50).all()
        if not events:
            return 0.0, 0
        avg = sum(e.severity_score for e in events) / len(events)
        return avg, len(events)
