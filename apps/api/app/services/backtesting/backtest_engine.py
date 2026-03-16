from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, asc, desc
from sqlalchemy.orm import Session

from app.models import BacktestResult, Opportunity, PriceSnapshot


class BacktestEngine:
    """
    Engine for evaluating historical performance of opportunities using
    stored PriceSnapshot data.

    For each Opportunity, the engine:
    1. Locates the detection timestamp.
    2. Retrieves a price snapshot at (or nearest before) detection.
    3. Retrieves price snapshots near +1h, +24h, +7d.
    4. Computes ROI metrics for each horizon.
    5. Stores a BacktestResult row.
    """

    def __init__(
        self,
        *,
        max_snapshot_skew_minutes: int = 10,
    ) -> None:
        # Maximum allowed time difference (in minutes) between the target
        # timestamp and a matching PriceSnapshot.
        self._max_skew = max(1, int(max_snapshot_skew_minutes))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def backtest_opportunity(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> Optional[BacktestResult]:
        """
        Run a backtest for a single Opportunity and store a BacktestResult.
        """
        detected_at = opportunity.detected_at
        token = opportunity.asset_symbol or opportunity.base_symbol

        if detected_at is None or not token:
            return None

        if detected_at.tzinfo is None:
            detected_at = detected_at.replace(tzinfo=timezone.utc)

        price_at_detection = self._find_price_near(db, token, detected_at)
        if price_at_detection is None:
            return None

        price_1h = self._find_price_near(
            db, token, detected_at + timedelta(hours=1)
        )
        price_24h = self._find_price_near(
            db, token, detected_at + timedelta(hours=24)
        )
        price_7d = self._find_price_near(
            db, token, detected_at + timedelta(days=7)
        )

        def _roi(p: Optional[float]) -> Optional[float]:
            if p is None or price_at_detection is None or price_at_detection <= 0:
                return None
            return (p - price_at_detection) / price_at_detection * 100.0

        roi_1h = _roi(price_1h)
        roi_24h = _roi(price_24h)
        roi_7d = _roi(price_7d)

        success_flag: Optional[bool] = None
        if roi_24h is not None:
            success_flag = roi_24h > 0.0

        result = BacktestResult(
            opportunity_id=opportunity.id,
            token_symbol=token,
            price_at_detection=price_at_detection,
            price_after_1h=price_1h,
            price_after_24h=price_24h,
            price_after_7d=price_7d,
            roi_1h_percent=roi_1h,
            roi_24h_percent=roi_24h,
            roi_7d_percent=roi_7d,
            success_flag=success_flag,
        )

        db.add(result)
        db.commit()
        db.refresh(result)

        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _find_price_near(
        self,
        db: Session,
        token_symbol: str,
        target_ts: datetime,
    ) -> Optional[float]:
        """
        Find a PriceSnapshot price for token_symbol nearest to target_ts
        within the allowed skew window.
        """
        if target_ts.tzinfo is None:
            target_ts = target_ts.replace(tzinfo=timezone.utc)

        # First try snapshots at or before target_ts.
        before = (
            db.query(PriceSnapshot)
            .filter(
                PriceSnapshot.token_symbol == token_symbol.upper(),
                PriceSnapshot.timestamp <= target_ts,
            )
            .order_by(PriceSnapshot.timestamp.desc())
            .first()
        )

        # Then snapshots after target_ts.
        after = (
            db.query(PriceSnapshot)
            .filter(
                PriceSnapshot.token_symbol == token_symbol.upper(),
                PriceSnapshot.timestamp > target_ts,
            )
            .order_by(PriceSnapshot.timestamp.asc())
            .first()
        )

        best: Optional[PriceSnapshot] = None
        best_delta: Optional[float] = None

        for cand in (before, after):
            if not cand:
                continue
            delta = abs((cand.timestamp - target_ts).total_seconds()) / 60.0
            if delta <= self._max_skew and (best_delta is None or delta < best_delta):
                best = cand
                best_delta = delta

        return float(best.price) if best is not None else None

