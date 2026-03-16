from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Opportunity, PriceSnapshot, SimulatedTrade


class TradeSimulator:
    """
    Simulate simple entry/exit trades for an Opportunity using stored
    PriceSnapshot data.

    Default rules:
    - Entry price: nearest snapshot price to opportunity.detected_at.
    - Exit when the first of these conditions is met:
        * price reaches +take_profit_pct relative to entry (default +10%)
        * price reaches -stop_loss_pct relative to entry (default -5%)
        * timeout_hours elapse (default 24h), using the last available price
          within the window (or entry price if no snapshots exist).

    Profit is reported in both percent and USD, assuming a fixed notional
    position size (default 1,000 USD).
    """

    def __init__(
        self,
        *,
        take_profit_pct: float = 10.0,
        stop_loss_pct: float = 5.0,
        timeout_hours: int = 24,
        notional_usd: float = 1_000.0,
    ) -> None:
        self._take_profit_pct = float(take_profit_pct)
        self._stop_loss_pct = float(stop_loss_pct)
        self._timeout_hours = max(1, int(timeout_hours))
        self._notional_usd = float(notional_usd)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def simulate_for_opportunity(
        self,
        db: Session,
        opportunity: Opportunity,
    ) -> Optional[SimulatedTrade]:
        """
        Run a trade simulation for a single Opportunity and persist a
        SimulatedTrade row.
        """
        detected_at = opportunity.detected_at
        token = opportunity.asset_symbol or opportunity.base_symbol

        if detected_at is None or not token:
            return None

        if detected_at.tzinfo is None:
            detected_at = detected_at.replace(tzinfo=timezone.utc)

        # Determine the entry price using the nearest snapshot to detected_at.
        entry_price = self._find_price_near(db, token, detected_at)
        if entry_price is None or entry_price <= 0:
            return None

        start_ts = detected_at
        end_ts = detected_at + timedelta(hours=self._timeout_hours)

        snapshots = (
            db.query(PriceSnapshot)
            .filter(
                PriceSnapshot.token_symbol == token.upper(),
                PriceSnapshot.timestamp >= start_ts,
                PriceSnapshot.timestamp <= end_ts,
            )
            .order_by(PriceSnapshot.timestamp.asc())
            .all()
        )

        # Default exit: at timeout with last known price (or entry if none).
        exit_price = entry_price
        exit_timestamp = end_ts

        if snapshots:
            last_price = entry_price
            last_ts = start_ts

            for snap in snapshots:
                last_price = float(snap.price)
                last_ts = snap.timestamp

                roi = (last_price - entry_price) / entry_price * 100.0

                if roi >= self._take_profit_pct:
                    exit_price = last_price
                    exit_timestamp = last_ts
                    break
                if roi <= -self._stop_loss_pct:
                    exit_price = last_price
                    exit_timestamp = last_ts
                    break
            else:
                # Neither TP nor SL hit; exit at timeout with the last known price.
                exit_price = last_price
                exit_timestamp = min(last_ts, end_ts)

        profit_percent = (exit_price - entry_price) / entry_price * 100.0
        profit_usd = self._notional_usd * (profit_percent / 100.0)

        trade = SimulatedTrade(
            opportunity_id=opportunity.id,
            token_symbol=token.upper(),
            entry_price=entry_price,
            exit_price=exit_price,
            entry_timestamp=start_ts,
            exit_timestamp=exit_timestamp,
            profit_percent=profit_percent,
            profit_usd=profit_usd,
        )

        db.add(trade)
        db.commit()
        db.refresh(trade)

        return trade

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _find_price_near(
        self,
        db: Session,
        token_symbol: str,
        target_ts: datetime,
        *,
        max_skew_minutes: int = 10,
    ) -> Optional[float]:
        """
        Find a PriceSnapshot price for token_symbol nearest to target_ts
        within the allowed skew window.
        """
        if target_ts.tzinfo is None:
            target_ts = target_ts.replace(tzinfo=timezone.utc)

        max_skew = max(1, int(max_skew_minutes))

        before = (
            db.query(PriceSnapshot)
            .filter(
                PriceSnapshot.token_symbol == token_symbol.upper(),
                PriceSnapshot.timestamp <= target_ts,
            )
            .order_by(PriceSnapshot.timestamp.desc())
            .first()
        )

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
            if delta <= max_skew and (best_delta is None or delta < best_delta):
                best = cand
                best_delta = delta

        return float(best.price) if best is not None else None

