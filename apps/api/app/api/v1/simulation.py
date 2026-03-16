from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SimulatedPortfolio, SimulatedTrade
from app.services.simulation.portfolio_engine import PortfolioPerformanceEngine


router = APIRouter(prefix="/api/v1/simulation", tags=["simulation"])


def _serialize_trade(trade: SimulatedTrade) -> Dict:
    return {
        "id": trade.id,
        "opportunity_id": trade.opportunity_id,
        "token_symbol": trade.token_symbol,
        "entry_price": trade.entry_price,
        "exit_price": trade.exit_price,
        "entry_timestamp": trade.entry_timestamp.isoformat(),
        "exit_timestamp": trade.exit_timestamp.isoformat(),
        "profit_percent": trade.profit_percent,
        "profit_usd": trade.profit_usd,
        "created_at": trade.created_at.isoformat(),
    }


def _serialize_portfolio(portfolio: SimulatedPortfolio) -> Dict:
    return {
        "id": portfolio.id,
        "portfolio_name": portfolio.portfolio_name,
        "starting_balance": portfolio.starting_balance,
        "current_balance": portfolio.current_balance,
        "created_at": portfolio.created_at.isoformat(),
        "updated_at": portfolio.updated_at.isoformat(),
    }


@router.get("/trades")
def get_simulated_trades(
    db: Session = Depends(get_db),
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
        description="Maximum number of simulated trades to return.",
    ),
    token_symbol: Optional[str] = Query(
        default=None,
        description="Optional token symbol filter (e.g. SOL, TAO).",
    ),
) -> List[Dict]:
    """
    Return recent simulated trades, optionally filtered by token_symbol.
    """
    query = db.query(SimulatedTrade).order_by(SimulatedTrade.created_at.desc())

    if token_symbol:
        query = query.filter(SimulatedTrade.token_symbol == token_symbol.upper())

    trades = query.limit(limit).all()
    return [_serialize_trade(t) for t in trades]


@router.get("/portfolio")
def get_simulated_portfolios(
    db: Session = Depends(get_db),
) -> List[Dict]:
    """
    Return all simulated portfolios.
    """
    portfolios = db.query(SimulatedPortfolio).order_by(
        SimulatedPortfolio.created_at.asc()
    ).all()
    return [_serialize_portfolio(p) for p in portfolios]


@router.get("/performance")
def get_portfolio_performance(
    db: Session = Depends(get_db),
    portfolio_id: Optional[int] = Query(
        default=None,
        description=(
            "Optional simulated portfolio ID whose starting_balance should be "
            "used as the baseline for performance metrics."
        ),
    ),
    starting_balance: Optional[float] = Query(
        default=None,
        description=(
            "Optional explicit starting balance for the performance calculation. "
            "If omitted, the engine will use the starting_balance of the first "
            "SimulatedPortfolio or fall back to 10,000 USD."
        ),
    ),
) -> Dict:
    """
    Aggregate all simulated trades into portfolio-level performance metrics.

    The equity curve is computed over all SimulatedTrade rows ordered by
    exit_timestamp. By default, the starting balance is taken from the
    specified SimulatedPortfolio (if portfolio_id is provided) or the
    first available SimulatedPortfolio; otherwise a default of 10,000 USD
    is used. When no trades exist, returns stub values so the frontend can render.
    """
    trades = db.query(SimulatedTrade).all()
    if not trades:
        return {
            "starting_balance": 10_000.0,
            "total_return": 0.0,
            "win_rate": 0.0,
            "average_trade_roi": 0.0,
            "max_drawdown": 0.0,
        }

    base_balance: Optional[float] = starting_balance

    if base_balance is None:
        portfolio: Optional[SimulatedPortfolio] = None
        if portfolio_id is not None:
            portfolio = (
                db.query(SimulatedPortfolio)
                .filter(SimulatedPortfolio.id == portfolio_id)
                .first()
            )
            if portfolio is None:
                raise HTTPException(status_code=404, detail="Simulated portfolio not found")
        else:
            portfolio = (
                db.query(SimulatedPortfolio)
                .order_by(SimulatedPortfolio.created_at.asc())
                .first()
            )

        if portfolio is not None:
            base_balance = float(portfolio.starting_balance)
        else:
            base_balance = 10_000.0

    engine = PortfolioPerformanceEngine()
    result = engine.compute_performance(trades, starting_balance=base_balance)

    return {
        "starting_balance": base_balance,
        "total_return": result.total_return,
        "win_rate": result.win_rate,
        "average_trade_roi": result.average_trade_roi,
        "max_drawdown": result.max_drawdown,
    }

