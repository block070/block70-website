"""
TradingStrategy API: user-defined strategies with entry/exit rules and backtesting.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import (
    User,
    TradingStrategy,
    StrategyBacktest,
    StrategySimulatedTrade,
)
from app.schemas.strategy_execution import merge_execution_into_conditions
from app.schemas.trading_strategy import (
    TradingStrategyRead,
    TradingStrategyCreate,
    StrategyBacktestRead,
    StrategySimulatedTradeRead,
    StrategyBacktestRunRequest,
    StrategyBacktestRunResponse,
    strategy_backtest_read_from_row,
)
from app.services.strategy.backtest_engine import strategy_backtest_engine
from app.services.strategy.trade_simulator import strategy_trade_simulator


router = APIRouter(prefix="/api/v1/trading-strategies", tags=["trading_strategies"])


def _conditions_to_str(raw: Any) -> str:
    if isinstance(raw, str):
        return raw
    return json.dumps(raw) if raw is not None else "{}"


def _owned_strategy(
    db: Session,
    strategy_id: int,
    user_id: int,
) -> Optional[TradingStrategy]:
    return (
        db.query(TradingStrategy)
        .filter(
            TradingStrategy.id == strategy_id,
            TradingStrategy.user_id == user_id,
        )
        .first()
    )


@router.get("", response_model=List[TradingStrategyRead])
def list_strategies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[TradingStrategyRead]:
    """List current user's trading strategies."""
    rows = (
        db.query(TradingStrategy)
        .filter(TradingStrategy.user_id == current_user.id)
        .order_by(TradingStrategy.created_at.desc())
        .all()
    )
    return [TradingStrategyRead.model_validate(r) for r in rows]


@router.post("", response_model=TradingStrategyRead, status_code=201)
def create_strategy(
    payload: TradingStrategyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TradingStrategyRead:
    """Create a new trading strategy."""
    conditions = dict(payload.conditions_json or {})
    if payload.execution is not None:
        conditions = merge_execution_into_conditions(conditions, payload.execution)
    strategy = TradingStrategy(
        user_id=current_user.id,
        strategy_name=payload.strategy_name,
        description=payload.description,
        conditions_json=_conditions_to_str(conditions),
        entry_rules=payload.entry_rules,
        exit_rules=payload.exit_rules,
        is_public=payload.is_public,
    )
    db.add(strategy)
    db.flush()
    from app.services.rewards.reward_engine import award_blocks

    award_blocks(db, current_user.id, "strategy_created", description="Strategy created")
    db.commit()
    db.refresh(strategy)
    return TradingStrategyRead.model_validate(strategy)


@router.get("/public", response_model=List[TradingStrategyRead])
def list_public_strategies(
    db: Session = Depends(get_db),
    limit: int = 50,
) -> List[TradingStrategyRead]:
    """List public strategies (no auth)."""
    rows = (
        db.query(TradingStrategy)
        .filter(TradingStrategy.is_public == True)
        .order_by(TradingStrategy.updated_at.desc())
        .limit(limit)
        .all()
    )
    return [TradingStrategyRead.model_validate(r) for r in rows]


@router.get("/leaderboard")
def leaderboard(
    db: Session = Depends(get_db),
    limit: int = 20,
    public_only: bool = False,
) -> Dict[str, Any]:
    """Rank strategies by performance (average_profit * win_rate). Optionally only public strategies."""
    q = db.query(TradingStrategy)
    if public_only:
        q = q.filter(TradingStrategy.is_public == True)
    strategy_ids = [s.id for s in q.all()]
    backtests = (
        db.query(StrategyBacktest)
        .filter(StrategyBacktest.strategy_id.in_(strategy_ids))
        .order_by(StrategyBacktest.strategy_id, StrategyBacktest.created_at.desc())
        .all()
    )
    by_strategy: Dict[int, StrategyBacktest] = {}
    for b in backtests:
        if b.strategy_id not in by_strategy:
            by_strategy[b.strategy_id] = b
    strategies = (
        db.query(TradingStrategy)
        .filter(TradingStrategy.id.in_(by_strategy.keys()))
        .all()
    )
    scored = [(s, by_strategy[s.id]) for s in strategies]
    scored.sort(
        key=lambda x: (x[1].average_profit or 0) * (x[1].win_rate or 0),
        reverse=True,
    )
    out = []
    for rank, (s, b) in enumerate(scored[:limit], 1):
        out.append({
            "rank": rank,
            "strategy_id": s.id,
            "strategy_name": s.strategy_name,
            "win_rate": b.win_rate,
            "average_profit": b.average_profit,
            "total_trades": b.total_trades,
            "max_drawdown": b.max_drawdown,
            "total_return_pct": getattr(b, "total_return_pct", 0.0) or 0.0,
        })
    return {"leaderboard": out}


@router.get("/templates")
def list_templates() -> Dict[str, List[Dict[str, Any]]]:
    """Return predefined strategy templates (Momentum, Breakout, Whale-following)."""
    default_exec = {
        "take_profit_pct": 10.0,
        "stop_loss_pct": 5.0,
        "max_hold_hours": 24,
        "stake_usd": 1000.0,
        "starting_capital": 100_000.0,
        "max_entries_per_run": 50,
    }
    return {
        "templates": [
            {
                "id": "momentum",
                "name": "Momentum",
                "description": "High-confidence signals (momentum proxy until OHLCV indicators land).",
                "conditions_json": {
                    "min_confidence": 0.82,
                    "min_signal_strength": 0.72,
                    "signal_types": ["wallet", "radar"],
                    "execution": {
                        **default_exec,
                        "take_profit_pct": 12.0,
                        "stop_loss_pct": 4.0,
                    },
                },
            },
            {
                "id": "breakout",
                "name": "Breakout",
                "description": "Signal-strength cluster breakout thresholds (radar-oriented).",
                "conditions_json": {
                    "min_signal_strength": 0.85,
                    "min_confidence": 0.7,
                    "signal_types": ["radar"],
                    "execution": {
                        **default_exec,
                        "take_profit_pct": 15.0,
                        "stop_loss_pct": 6.0,
                    },
                },
            },
            {
                "id": "whale_following",
                "name": "Whale following",
                "description": "Follow large-wallet accumulation signals.",
                "conditions_json": {
                    "signal_types": ["wallet"],
                    "min_signal_strength": 0.7,
                    "min_confidence": 0.65,
                    "execution": {
                        **default_exec,
                        "take_profit_pct": 10.0,
                        "stop_loss_pct": 5.0,
                    },
                },
            },
        ]
    }


@router.get("/share/{strategy_id}")
def get_public_strategy(
    strategy_id: int = Path(..., description="Strategy ID (public share)"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Public read-only strategy summary for sharing (no auth)."""
    strategy = db.get(TradingStrategy, strategy_id)
    if not strategy:
        raise HTTPException(404, "Strategy not found")
    latest = (
        db.query(StrategyBacktest)
        .filter(StrategyBacktest.strategy_id == strategy_id)
        .order_by(StrategyBacktest.created_at.desc())
        .first()
    )
    back: Dict[str, Any] | None = None
    if latest:
        back = {
            "total_trades": latest.total_trades,
            "win_rate": latest.win_rate,
            "average_profit": latest.average_profit,
            "max_drawdown": latest.max_drawdown,
            "total_return_pct": getattr(latest, "total_return_pct", 0.0) or 0.0,
        }
    return {
        "strategy_id": strategy.id,
        "strategy_name": strategy.strategy_name,
        "description": strategy.description,
        "backtest": back,
    }


@router.get("/public/{strategy_id}", response_model=TradingStrategyRead)
def get_public_strategy_by_id(
    strategy_id: int = Path(..., description="Strategy ID"),
    db: Session = Depends(get_db),
) -> TradingStrategyRead:
    """Get a public strategy by ID (no auth)."""
    strategy = (
        db.query(TradingStrategy)
        .filter(
            TradingStrategy.id == strategy_id,
            TradingStrategy.is_public == True,
        )
        .first()
    )
    if not strategy:
        raise HTTPException(404, "Strategy not found")
    return TradingStrategyRead.model_validate(strategy)


@router.get("/{strategy_id}", response_model=TradingStrategyRead)
def get_strategy(
    strategy_id: int = Path(..., description="Strategy ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TradingStrategyRead:
    """Get a strategy by ID (must belong to current user)."""
    strategy = _owned_strategy(db, strategy_id, current_user.id)
    if not strategy:
        raise HTTPException(404, "Strategy not found")
    return TradingStrategyRead.model_validate(strategy)


@router.get("/{strategy_id}/backtest", response_model=StrategyBacktestRead)
def get_strategy_backtest(
    strategy_id: int = Path(..., description="Strategy ID"),
    run: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StrategyBacktestRead:
    """
    Get latest backtest result for a strategy. If run=true, run backtest first.
    """
    strategy = _owned_strategy(db, strategy_id, current_user.id)
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    if run:
        strategy_backtest_engine.run_backtest(db, strategy_id)

    latest = (
        db.query(StrategyBacktest)
        .filter(StrategyBacktest.strategy_id == strategy_id)
        .order_by(StrategyBacktest.created_at.desc())
        .first()
    )
    if not latest:
        latest = strategy_backtest_engine.run_backtest(db, strategy_id)
    if not latest:
        raise HTTPException(404, "No backtest result")
    return strategy_backtest_read_from_row(latest)


@router.post("/{strategy_id}/backtest/run", response_model=StrategyBacktestRunResponse)
def post_strategy_backtest_run(
    strategy_id: int = Path(..., description="Strategy ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    body: StrategyBacktestRunRequest | None = Body(default=None),
) -> StrategyBacktestRunResponse:
    """
    Recompute backtest metrics (optional: refresh simulated trades first).
    Returns metrics, trades list, and equity_curve for charting.
    """
    req = body or StrategyBacktestRunRequest()
    strategy = _owned_strategy(db, strategy_id, current_user.id)
    if not strategy:
        raise HTTPException(404, "Strategy not found")

    if req.refresh_trades:
        strategy_trade_simulator.run_simulation(db, strategy_id)

    trades_rows = (
        db.query(StrategySimulatedTrade)
        .filter(StrategySimulatedTrade.strategy_id == strategy_id)
        .order_by(StrategySimulatedTrade.entry_time.asc())
        .all()
    )

    latest = strategy_backtest_engine.run_backtest(
        db,
        strategy_id,
        trades_rows,
        starting_capital=req.starting_capital,
        stake_usd=req.stake_usd,
    )
    if not latest:
        raise HTTPException(500, "Backtest failed")

    read = strategy_backtest_read_from_row(latest)
    trades_out = [StrategySimulatedTradeRead.model_validate(t) for t in trades_rows]
    return StrategyBacktestRunResponse(
        metrics=read,
        trades=trades_out,
        equity_curve=list(read.equity_curve),
    )


@router.get("/{strategy_id}/trades", response_model=List[StrategySimulatedTradeRead])
def list_strategy_trades(
    strategy_id: int = Path(..., description="Strategy ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[StrategySimulatedTradeRead]:
    """List simulated trades for a strategy."""
    strategy = _owned_strategy(db, strategy_id, current_user.id)
    if not strategy:
        raise HTTPException(404, "Strategy not found")
    rows = (
        db.query(StrategySimulatedTrade)
        .filter(StrategySimulatedTrade.strategy_id == strategy_id)
        .order_by(StrategySimulatedTrade.entry_time.desc())
        .all()
    )
    return [StrategySimulatedTradeRead.model_validate(r) for r in rows]


@router.post("/{strategy_id}/simulate")
def run_simulation(
    strategy_id: int = Path(..., description="Strategy ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Run trade simulation for the strategy (signals -> simulated trades)."""
    strategy = _owned_strategy(db, strategy_id, current_user.id)
    if not strategy:
        raise HTTPException(404, "Strategy not found")
    created = strategy_trade_simulator.run_simulation(db, strategy_id)
    return {"status": "ok", "trades_created": len(created)}
