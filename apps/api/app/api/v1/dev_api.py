"""
Developer API: same data as main API but requires X-API-Key and enforces rate limits.
Prefix: /api/v1/dev
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy.orm import Session

from app.core.api_auth_middleware import api_key_auth_dependency, record_usage_after
from app.db import get_db
from app.models import (
    ApiKey,
    Coin,
    MarketData,
    Opportunity,
    OpportunityStatus,
    Portfolio,
    PortfolioTokenBalance,
    PortfolioTransaction,
    Signal,
    TradingStrategy,
    User,
    WalletProfile,
)
from app.schemas.signals import SignalRead
from app.schemas.opportunity_db import OpportunityRead
from app.schemas.portfolio import (
    PortfolioRead,
    PortfolioTokenBalanceRead,
    PortfolioTransactionRead,
)
from app.services.analysis.trending_signal_engine import TrendingSignalEngine
from app.services.portfolio.portfolio_analytics_engine import portfolio_analytics_engine

router = APIRouter(prefix="/api/v1/dev", tags=["developer-api"])


def _get_portfolio(db: Session, user_id: int) -> Portfolio | None:
    return db.query(Portfolio).filter(Portfolio.user_id == user_id).first()


# ---- Signals ----
@router.get("/signals", response_model=List[dict])
def dev_list_signals(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    chain: Optional[str] = Query(None),
    signal_type: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    q = db.query(Signal).order_by(Signal.created_at.desc())
    if chain:
        q = q.filter(Signal.chain == chain)
    if signal_type:
        q = q.filter(Signal.signal_type == signal_type)
    if token:
        q = q.filter(
            (Signal.token_symbol == token) | (Signal.token_address == token)
        )
    rows = q.offset(offset).limit(limit).all()
    return [
        {
            "id": s.id,
            "token_symbol": s.token_symbol,
            "token_address": s.token_address,
            "chain": s.chain,
            "signal_type": s.signal_type,
            "confidence_score": float(s.confidence_score or 0),
            "signal_strength": float(s.signal_strength or 0),
            "title": s.title,
            "created_at": (s.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for s in rows
    ]


@router.get("/signals/latest", response_model=List[dict])
def dev_signals_latest(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    rows = (
        db.query(Signal)
        .order_by(Signal.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "token_symbol": s.token_symbol,
            "signal_type": s.signal_type,
            "confidence_score": float(s.confidence_score or 0),
            "created_at": (s.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for s in rows
    ]


@router.get("/signals/{token}", response_model=List[dict])
def dev_signals_for_token(
    request: Request,
    token: str = Path(...),
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    rows = (
        db.query(Signal)
        .filter(
            (Signal.token_symbol == token) | (Signal.token_address == token)
        )
        .order_by(Signal.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "token_symbol": s.token_symbol,
            "signal_type": s.signal_type,
            "confidence_score": float(s.confidence_score or 0),
            "created_at": (s.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for s in rows
    ]


# ---- Wallets ----
@router.get("/wallets", response_model=List[dict])
def dev_list_wallets(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    rows = (
        db.query(WalletProfile)
        .order_by(WalletProfile.average_roi.desc().nullslast())
        .limit(limit)
        .all()
    )
    return [
        {
            "wallet_address": w.wallet_address,
            "win_rate": w.win_rate,
            "average_roi": w.average_roi,
            "total_profit_usd": w.total_profit_usd,
        }
        for w in rows
    ]


@router.get("/wallets/{address}", response_model=dict)
def dev_get_wallet(
    request: Request,
    address: str = Path(...),
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> dict:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    w = (
        db.query(WalletProfile)
        .filter(WalletProfile.wallet_address == address)
        .first()
    )
    if not w:
        raise HTTPException(404, "Wallet not found")
    return {
        "wallet_address": w.wallet_address,
        "win_rate": w.win_rate,
        "average_roi": w.average_roi,
        "total_profit_usd": w.total_profit_usd,
    }


@router.get("/wallets/{address}/transactions", response_model=List[dict])
def dev_wallet_transactions(
    request: Request,
    address: str = Path(...),
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    opps = (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "wallet",
            Opportunity.asset_symbol == address,
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )
        .order_by(Opportunity.detected_at.desc().nullslast())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": o.id,
            "title": o.title,
            "type": o.type,
            "asset_symbol": o.asset_symbol,
            "total_score": o.total_score,
            "detected_at": (o.detected_at or o.created_at).isoformat() if (o.detected_at or o.created_at) else None,
        }
        for o in opps
    ]


# ---- Opportunities ----
@router.get("/opportunities", response_model=List[OpportunityRead])
def dev_list_opportunities(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None),
    chain: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
) -> List[Opportunity]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    q = (
        db.query(Opportunity)
        .filter(Opportunity.status == OpportunityStatus.ACTIVE.value)
        .order_by(Opportunity.total_score.desc())
    )
    if type:
        q = q.filter(Opportunity.type == type)
    if chain:
        q = q.filter(Opportunity.chain == chain)
    return q.limit(limit).all()


@router.get("/opportunities/{id}", response_model=OpportunityRead)
def dev_get_opportunity(
    request: Request,
    id: int = Path(...),
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> Opportunity:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    o = db.get(Opportunity, id)
    if not o:
        raise HTTPException(404, "Opportunity not found")
    return o


# ---- Market ----
@router.get("/market/prices", response_model=List[dict])
def dev_market_prices(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    rows = (
        db.query(MarketData, Coin)
        .join(Coin, MarketData.coin_id == Coin.id)
        .order_by(MarketData.timestamp.desc())
        .limit(limit)
        .all()
    )
    out = []
    seen = set()
    for md, coin in rows:
        if coin.id in seen:
            continue
        seen.add(coin.id)
        out.append({
            "symbol": coin.symbol,
            "price": md.price,
            "market_cap": md.market_cap,
            "volume_24h": md.volume_24h,
            "price_change_24h": md.price_change_24h,
            "timestamp": (md.timestamp or datetime.now(timezone.utc)).isoformat(),
        })
    return out


@router.get("/market/trending", response_model=List[dict])
def dev_market_trending(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    engine = TrendingSignalEngine(lookback_hours=24.0)
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    results = engine.get_trending(db, since=since, limit=limit)
    return [
        {
            "token_symbol": t.token_symbol,
            "token_address": t.token_address,
            "chain": t.chain,
            "signal_count": t.signal_count,
            "avg_confidence_score": round(t.avg_confidence_score, 4),
        }
        for t in results
    ]


@router.get("/market/gainers", response_model=List[dict])
def dev_market_gainers(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    rows = (
        db.query(MarketData, Coin)
        .join(Coin, MarketData.coin_id == Coin.id)
        .filter(MarketData.price_change_24h.isnot(None), MarketData.price_change_24h > 0)
        .order_by(MarketData.price_change_24h.desc())
        .limit(limit)
        .all()
    )
    return [
        {"symbol": c.symbol, "price": md.price, "price_change_24h": md.price_change_24h}
        for md, c in rows
    ]


@router.get("/market/losers", response_model=List[dict])
def dev_market_losers(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    rows = (
        db.query(MarketData, Coin)
        .join(Coin, MarketData.coin_id == Coin.id)
        .filter(MarketData.price_change_24h.isnot(None), MarketData.price_change_24h < 0)
        .order_by(MarketData.price_change_24h.asc())
        .limit(limit)
        .all()
    )
    return [
        {"symbol": c.symbol, "price": md.price, "price_change_24h": md.price_change_24h}
        for md, c in rows
    ]


# ---- Airdrops ----
@router.get("/airdrops", response_model=List[OpportunityRead])
def dev_airdrops(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> List[Opportunity]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    return (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "airdrop",
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )
        .order_by(Opportunity.total_score.desc())
        .all()
    )


@router.get("/airdrops/upcoming", response_model=List[OpportunityRead])
def dev_airdrops_upcoming(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
) -> List[Opportunity]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    return (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "airdrop",
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )
        .order_by(Opportunity.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/airdrops/active", response_model=List[OpportunityRead])
def dev_airdrops_active(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> List[Opportunity]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    return (
        db.query(Opportunity)
        .filter(
            Opportunity.type == "airdrop",
            Opportunity.status == OpportunityStatus.ACTIVE.value,
        )
        .order_by(Opportunity.total_score.desc())
        .all()
    )


# ---- Strategies (user's strategies) ----
@router.get("/strategies", response_model=List[dict])
def dev_list_strategies(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    rows = (
        db.query(TradingStrategy)
        .filter(TradingStrategy.user_id == user.id)
        .order_by(TradingStrategy.updated_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "strategy_name": s.strategy_name,
            "description": s.description,
            "is_public": getattr(s, "is_public", False),
            "created_at": (s.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for s in rows
    ]


@router.get("/strategies/backtests", response_model=List[dict])
def dev_list_backtests(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    from app.models import StrategyBacktest
    rows = (
        db.query(StrategyBacktest, TradingStrategy)
        .join(TradingStrategy, StrategyBacktest.strategy_id == TradingStrategy.id)
        .filter(TradingStrategy.user_id == user.id)
        .order_by(StrategyBacktest.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "strategy_id": b.strategy_id,
            "strategy_name": s.strategy_name,
            "total_trades": b.total_trades,
            "win_rate": b.win_rate,
            "average_profit": b.average_profit,
            "max_drawdown": b.max_drawdown,
            "created_at": (b.created_at or datetime.now(timezone.utc)).isoformat(),
        }
        for b, s in rows
    ]


@router.get("/strategies/{id}", response_model=dict)
def dev_get_strategy(
    request: Request,
    id: int = Path(...),
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> dict:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    s = (
        db.query(TradingStrategy)
        .filter(TradingStrategy.id == id, TradingStrategy.user_id == user.id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Strategy not found")
    return {
        "id": s.id,
        "strategy_name": s.strategy_name,
        "description": s.description,
        "entry_rules": s.entry_rules,
        "exit_rules": s.exit_rules,
        "is_public": getattr(s, "is_public", False),
        "created_at": (s.created_at or datetime.now(timezone.utc)).isoformat(),
    }


# ---- Portfolio ----
@router.get("/portfolio", response_model=dict)
def dev_portfolio(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> dict:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    portfolio = _get_portfolio(db, user.id)
    if not portfolio:
        return {"portfolio": None, "message": "No portfolio yet"}
    return {
        "portfolio": PortfolioRead.model_validate(portfolio),
    }


@router.get("/portfolio/tokens", response_model=List[dict])
def dev_portfolio_tokens(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> List[dict]:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    portfolio = _get_portfolio(db, user.id)
    if not portfolio:
        return []
    rows = (
        db.query(PortfolioTokenBalance)
        .filter(PortfolioTokenBalance.portfolio_id == portfolio.id)
        .all()
    )
    return [PortfolioTokenBalanceRead.model_validate(r).model_dump() for r in rows]


@router.get("/portfolio/performance", response_model=dict)
def dev_portfolio_performance(
    request: Request,
    auth: tuple[ApiKey, User] = Depends(api_key_auth_dependency),
    db: Session = Depends(get_db),
) -> dict:
    api_key, user = auth
    record_usage_after(api_key, request.url.path, db)
    portfolio = _get_portfolio(db, user.id)
    if not portfolio:
        return {"total_value_usd": 0, "total_profit_loss": 0}
    metrics = portfolio_analytics_engine.get_metrics(db, portfolio.id)
    return {
        "total_value_usd": metrics.get("total_value_usd", 0) or portfolio.total_value_usd,
        "total_profit_loss": metrics.get("total_profit_loss", 0) or portfolio.total_profit_loss,
    }
