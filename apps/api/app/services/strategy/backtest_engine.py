"""
Backtest engine for TradingStrategy: run on historical data, compute win rate,
profit/loss, drawdown, average trade duration; persist StrategyBacktest.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import (
    TradingStrategy,
    StrategySimulatedTrade,
    StrategyBacktest,
)


class StrategyBacktestEngine:
    """
    Run strategies on historical data (StrategySimulatedTrade rows),
    calculate metrics and store StrategyBacktest.
    """

    def run_backtest(
        self,
        db: Session,
        strategy_id: int,
        trades: Optional[List[StrategySimulatedTrade]] = None,
    ) -> Optional[StrategyBacktest]:
        """
        Compute backtest metrics from strategy's simulated trades and persist.
        If trades is None, load from DB for this strategy.
        """
        strategy = db.get(TradingStrategy, strategy_id)
        if not strategy:
            return None

        if trades is None:
            trades = (
                db.query(StrategySimulatedTrade)
                .filter(StrategySimulatedTrade.strategy_id == strategy_id)
                .order_by(StrategySimulatedTrade.entry_time.asc())
                .all()
            )

        if not trades:
            result = StrategyBacktest(
                strategy_id=strategy_id,
                total_trades=0,
                win_rate=0.0,
                average_profit=0.0,
                max_drawdown=0.0,
            )
            db.add(result)
            db.commit()
            db.refresh(result)
            return result

        total = len(trades)
        wins = sum(1 for t in trades if t.profit_percent > 0)
        win_rate = wins / total if total else 0.0
        average_profit = sum(t.profit_percent for t in trades) / total if total else 0.0

        # Drawdown: peak-to-trough decline in cumulative P&L
        cumulative = 0.0
        peak = 0.0
        max_dd = 0.0
        for t in trades:
            cumulative += t.profit_percent
            if cumulative > peak:
                peak = cumulative
            dd = peak - cumulative
            if dd > max_dd:
                max_dd = dd
        max_drawdown = max_dd

        result = StrategyBacktest(
            strategy_id=strategy_id,
            total_trades=total,
            win_rate=win_rate,
            average_profit=average_profit,
            max_drawdown=max_drawdown,
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result


strategy_backtest_engine = StrategyBacktestEngine()
