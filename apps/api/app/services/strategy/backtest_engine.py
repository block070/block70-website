"""
Backtest engine for TradingStrategy: aggregate StrategySimulatedTrade rows,
compute portfolio equity curve, ROI, win rate, equity max drawdown; persist StrategyBacktest.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy.orm import Session

from app.models import StrategyBacktest, StrategySimulatedTrade, TradingStrategy
from app.schemas.strategy_execution import parse_execution_from_conditions


def _conditions_dict(strategy: TradingStrategy) -> dict[str, Any]:
    try:
        raw = strategy.conditions_json
        if isinstance(raw, str):
            return json.loads(raw or "{}")
        return dict(raw) if raw else {}
    except (json.JSONDecodeError, TypeError):
        return {}


class StrategyBacktestEngine:
    """
    Run strategies on simulated trades; compute equity-based metrics and store StrategyBacktest.
    """

    def compute_equity_series(
        self,
        trades: List[StrategySimulatedTrade],
        *,
        starting_capital: float,
        stake_usd: float,
    ) -> tuple[float, float, list[dict[str, Any]]]:
        """
        Returns (total_return_pct, max_equity_drawdown_pct, equity_curve).
        max_equity_drawdown_pct is max peak-to-trough decline as % of running peak equity.
        """
        if not trades:
            return 0.0, 0.0, []

        ordered = sorted(trades, key=lambda t: t.exit_time)
        equity = float(starting_capital)
        curve: list[dict[str, Any]] = []
        if ordered:
            curve.append(
                {
                    "t": ordered[0].entry_time.isoformat(),
                    "equity": equity,
                }
            )

        peak = equity
        max_dd_pct = 0.0

        for t in ordered:
            pnl = stake_usd * (t.profit_percent / 100.0)
            equity += pnl
            et = t.exit_time
            if isinstance(et, datetime):
                ts = et.isoformat()
            else:
                ts = str(et)
            curve.append({"t": ts, "equity": round(equity, 4)})
            if equity > peak:
                peak = equity
            if peak > 0:
                dd_pct = (peak - equity) / peak * 100.0
                max_dd_pct = max(max_dd_pct, dd_pct)

        total_ret = (
            (equity - starting_capital) / starting_capital * 100.0
            if starting_capital > 0
            else 0.0
        )
        return total_ret, max_dd_pct, curve

    def run_backtest(
        self,
        db: Session,
        strategy_id: int,
        trades: Optional[List[StrategySimulatedTrade]] = None,
        *,
        starting_capital: Optional[float] = None,
        stake_usd: Optional[float] = None,
    ) -> Optional[StrategyBacktest]:
        strategy = db.get(TradingStrategy, strategy_id)
        if not strategy:
            return None

        conditions = _conditions_dict(strategy)
        ex = parse_execution_from_conditions(conditions)
        start_c = starting_capital if starting_capital is not None else ex.starting_capital
        stake = stake_usd if stake_usd is not None else ex.stake_usd

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
                total_return_pct=0.0,
                equity_curve_json=json.dumps([]),
            )
            db.add(result)
            db.commit()
            db.refresh(result)
            return result

        total = len(trades)
        wins = sum(1 for t in trades if t.profit_percent > 0)
        win_rate = wins / total if total else 0.0
        average_profit = sum(t.profit_percent for t in trades) / total if total else 0.0

        total_ret, max_dd_pct, curve = self.compute_equity_series(
            trades, starting_capital=start_c, stake_usd=stake
        )

        result = StrategyBacktest(
            strategy_id=strategy_id,
            total_trades=total,
            win_rate=win_rate,
            average_profit=average_profit,
            max_drawdown=max_dd_pct,
            total_return_pct=total_ret,
            equity_curve_json=json.dumps(curve),
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result


strategy_backtest_engine = StrategyBacktestEngine()
