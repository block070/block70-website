"""
Market pattern analyzer: coordinated wallet accumulation, narrative momentum,
market rotations.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import CapitalFlow, MarketNarrative, RadarSignal, WalletProfile


@dataclass
class DetectedPattern:
    """A detected market pattern."""
    pattern_type: str  # coordinated_accumulation | narrative_momentum | market_rotation
    description: str
    tokens: List[str]
    strength: float
    metadata: dict


class PatternAnalyzer:
    """
    Detect patterns:
    - coordinated wallet accumulation (same token, multiple strong wallets)
    - narrative momentum (narratives with rising trend_score)
    - market rotations (capital flows from one asset/chain to another)
    """

    def detect_coordinated_accumulation(
        self,
        db: Session,
        *,
        token_symbol: str | None = None,
        min_wallets: int = 3,
        hours: int = 24,
    ) -> List[DetectedPattern]:
        """Find tokens where multiple high-reputation wallets are active."""
        # Use WalletProfile as proxy for "accumulation" (wallets with recent activity / high ROI)
        q = (
            db.query(WalletProfile.wallet_address, WalletProfile.average_roi, WalletProfile.win_rate)
            .filter(WalletProfile.total_trades >= 1)
            .order_by(WalletProfile.average_roi.desc().nullslast())
            .limit(50)
        )
        profiles = q.all()
        if len(profiles) < min_wallets:
            return []
        strength = sum(p.average_roi or 0 for p in profiles) / max(1, len(profiles))
        return [
            DetectedPattern(
                pattern_type="coordinated_accumulation",
                description=f"{len(profiles)} high-ROI wallets active; average ROI {strength:.1f}%",
                tokens=[token_symbol] if token_symbol else [],
                strength=min(1.0, strength / 100.0),
                metadata={"wallet_count": len(profiles), "avg_roi": strength},
            ),
        ]

    def detect_narrative_momentum(
        self,
        db: Session,
        *,
        min_trend_score: float = 0.5,
        limit: int = 5,
    ) -> List[DetectedPattern]:
        """Find narratives with rising trend_score."""
        q = (
            db.query(MarketNarrative)
            .filter(MarketNarrative.trend_score >= min_trend_score)
            .order_by(MarketNarrative.trend_score.desc())
            .limit(limit)
        )
        narratives = q.all()
        out = []
        for n in narratives:
            out.append(
                DetectedPattern(
                    pattern_type="narrative_momentum",
                    description=n.description or n.name,
                    tokens=[],
                    strength=n.trend_score,
                    metadata={"narrative": n.name, "trend_score": n.trend_score},
                ),
            )
        return out

    def detect_market_rotation(
        self,
        db: Session,
        *,
        hours: int = 24,
        limit: int = 10,
    ) -> List[DetectedPattern]:
        """Detect capital flows from one asset/chain to another (rotation)."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        q = (
            db.query(
                CapitalFlow.source_asset,
                CapitalFlow.destination_asset,
                CapitalFlow.chain,
                func.sum(CapitalFlow.amount).label("total"),
                func.count(CapitalFlow.id).label("cnt"),
            )
            .filter(CapitalFlow.timestamp >= since)
            .group_by(
                CapitalFlow.source_asset,
                CapitalFlow.destination_asset,
                CapitalFlow.chain,
            )
            .order_by(func.sum(CapitalFlow.amount).desc())
            .limit(limit)
        )
        rows = q.all()
        if not rows:
            return []
        tokens = list({r.source_asset for r in rows} | {r.destination_asset for r in rows})
        total = sum(float(r.total or 0) for r in rows)
        return [
            DetectedPattern(
                pattern_type="market_rotation",
                description=f"Capital flows {rows[0].source_asset} → {rows[0].destination_asset}; total volume {total:.0f}",
                tokens=tokens[:10],
                strength=min(1.0, total / 1e9),
                metadata={"flow_count": sum(r.cnt for r in rows), "total_amount": total},
            ),
        ]

    def run_all(
        self,
        db: Session,
        *,
        token_symbol: str | None = None,
        hours: int = 24,
    ) -> List[DetectedPattern]:
        """Run all detectors and return combined patterns."""
        out: List[DetectedPattern] = []
        out.extend(self.detect_narrative_momentum(db))
        out.extend(self.detect_market_rotation(db, hours=hours))
        out.extend(self.detect_coordinated_accumulation(db, token_symbol=token_symbol, hours=hours))
        return out
