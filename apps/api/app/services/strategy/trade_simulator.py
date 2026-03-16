"""
Trade simulator for TradingStrategy: simulate trades using market data,
signal triggers, and strategy rules; persist StrategySimulatedTrade.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import PriceSnapshot, Signal, TradingStrategy, StrategySimulatedTrade
from app.services.strategy.strategy_engine import strategy_engine


class StrategyTradeSimulator:
    """
    Simulate trades for a TradingStrategy using signals and PriceSnapshot data.
    """

    def __init__(
        self,
        *,
        take_profit_pct: float = 10.0,
        stop_loss_pct: float = 5.0,
        timeout_hours: int = 24,
    ) -> None:
        self._take_profit_pct = float(take_profit_pct)
        self._stop_loss_pct = float(stop_loss_pct)
        self._timeout_hours = max(1, int(timeout_hours))

    def _find_price_near(
        self,
        db: Session,
        token_symbol: str,
        target_ts: datetime,
        max_skew_minutes: int = 15,
    ) -> Optional[float]:
        if target_ts.tzinfo is None:
            target_ts = target_ts.replace(tzinfo=timezone.utc)
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
        best = None
        best_delta = None
        for cand in (before, after):
            if not cand:
                continue
            delta = abs((cand.timestamp - target_ts).total_seconds()) / 60.0
            if delta <= max_skew_minutes and (best_delta is None or delta < best_delta):
                best = cand
                best_delta = delta
        return float(best.price) if best else None

    def simulate_from_entries(
        self,
        db: Session,
        strategy: TradingStrategy,
        entry_token: str,
        entry_time: datetime,
    ) -> Optional[StrategySimulatedTrade]:
        """
        Simulate one trade: entry at entry_time for entry_token, exit by TP/SL/timeout.
        """
        if entry_time.tzinfo is None:
            entry_time = entry_time.replace(tzinfo=timezone.utc)
        entry_price = self._find_price_near(db, entry_token, entry_time)
        if entry_price is None or entry_price <= 0:
            return None

        end_ts = entry_time + timedelta(hours=self._timeout_hours)
        snapshots = (
            db.query(PriceSnapshot)
            .filter(
                PriceSnapshot.token_symbol == entry_token.upper(),
                PriceSnapshot.timestamp >= entry_time,
                PriceSnapshot.timestamp <= end_ts,
            )
            .order_by(PriceSnapshot.timestamp.asc())
            .all()
        )

        exit_price = entry_price
        exit_time = end_ts

        if snapshots:
            last_price = entry_price
            last_ts = entry_time
            for snap in snapshots:
                last_price = float(snap.price)
                last_ts = snap.timestamp
                roi = (last_price - entry_price) / entry_price * 100.0
                if roi >= self._take_profit_pct or roi <= -self._stop_loss_pct:
                    exit_price = last_price
                    exit_time = last_ts
                    break
            else:
                exit_price = last_price
                exit_time = last_ts

        profit_percent = (exit_price - entry_price) / entry_price * 100.0

        trade = StrategySimulatedTrade(
            strategy_id=strategy.id,
            token_symbol=entry_token.upper(),
            entry_price=entry_price,
            exit_price=exit_price,
            profit_percent=profit_percent,
            entry_time=entry_time,
            exit_time=exit_time,
        )
        db.add(trade)
        db.commit()
        db.refresh(trade)
        return trade

    def run_simulation(
        self,
        db: Session,
        strategy_id: int,
    ) -> list[StrategySimulatedTrade]:
        """
        Load strategy, detect entry points from signals, simulate trades for each.
        """
        strategy = db.get(TradingStrategy, strategy_id)
        if not strategy:
            return []

        entries = strategy_engine.detect_entry_points(db, strategy)
        created: list[StrategySimulatedTrade] = []
        for e in entries[:50]:  # cap for one run
            sig = db.get(Signal, e.signal_id)
            entry_time = sig.created_at.replace(tzinfo=timezone.utc) if sig and sig.created_at else datetime.now(timezone.utc)
            trade = self.simulate_from_entries(
                db, strategy, e.token_symbol, entry_time
            )
            if trade:
                created.append(trade)
        return created


strategy_trade_simulator = StrategyTradeSimulator()
