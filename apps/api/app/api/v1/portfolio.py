from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, Portfolio, PortfolioWallet, PortfolioTokenBalance, PortfolioTransaction
from app.schemas.portfolio import (
    PortfolioRead,
    PortfolioWalletRead,
    PortfolioTokenBalanceRead,
    PortfolioTransactionRead,
    AddWalletPayload,
    PortfolioMetricsRead,
)
from app.services.portfolio.portfolio_sync_engine import portfolio_sync_engine
from app.services.portfolio.portfolio_analytics_engine import portfolio_analytics_engine
from app.services.portfolio.smart_money_overlap import detect_smart_money_overlap


router = APIRouter(prefix="/api/v1/portfolio", tags=["portfolio"])


def _get_or_create_portfolio(db: Session, user_id: int) -> Portfolio:
    p = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
    if p:
        return p
    p = Portfolio(user_id=user_id, portfolio_name="Default")
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("", response_model=PortfolioRead)
def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioRead:
    """Get or create the current user's portfolio."""
    portfolio = _get_or_create_portfolio(db, current_user.id)
    return PortfolioRead.model_validate(portfolio)


@router.get("/tokens", response_model=list[PortfolioTokenBalanceRead])
def get_portfolio_tokens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PortfolioTokenBalanceRead]:
    """List token balances for the user's portfolio."""
    portfolio = _get_or_create_portfolio(db, current_user.id)
    rows = (
        db.query(PortfolioTokenBalance)
        .filter(PortfolioTokenBalance.portfolio_id == portfolio.id)
        .all()
    )
    return [PortfolioTokenBalanceRead.model_validate(r) for r in rows]


@router.get("/transactions", response_model=list[PortfolioTransactionRead])
def get_portfolio_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[PortfolioTransactionRead]:
    """List recent transactions for the user's portfolio."""
    portfolio = _get_or_create_portfolio(db, current_user.id)
    rows = (
        db.query(PortfolioTransaction)
        .filter(PortfolioTransaction.portfolio_id == portfolio.id)
        .order_by(PortfolioTransaction.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [PortfolioTransactionRead.model_validate(r) for r in rows]


@router.post("/add-wallet", response_model=PortfolioWalletRead)
def add_wallet(
    payload: AddWalletPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioWalletRead:
    """Add a wallet to the user's portfolio. Chain: ethereum, solana, base, arbitrum."""
    chain_lower = payload.chain.lower().strip()
    if chain_lower not in ("ethereum", "solana", "base", "arbitrum"):
        raise HTTPException(400, "chain must be one of: ethereum, solana, base, arbitrum")
    portfolio = _get_or_create_portfolio(db, current_user.id)
    existing = (
        db.query(PortfolioWallet)
        .filter(
            PortfolioWallet.portfolio_id == portfolio.id,
            PortfolioWallet.wallet_address == payload.wallet_address.strip(),
            PortfolioWallet.chain == chain_lower,
        )
        .first()
    )
    if existing:
        return PortfolioWalletRead.model_validate(existing)
    w = PortfolioWallet(
        portfolio_id=portfolio.id,
        wallet_address=payload.wallet_address.strip(),
        chain=chain_lower,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return PortfolioWalletRead.model_validate(w)


@router.post("/sync")
def sync_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Trigger sync of wallet balances and total value."""
    portfolio = _get_or_create_portfolio(db, current_user.id)
    portfolio_sync_engine.sync_portfolio(db, portfolio.id)
    return {"status": "ok", "portfolio_id": portfolio.id}


@router.get("/metrics", response_model=PortfolioMetricsRead)
def get_portfolio_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioMetricsRead:
    """Get portfolio analytics: total value, P/L, best/worst tokens."""
    portfolio = _get_or_create_portfolio(db, current_user.id)
    metrics = portfolio_analytics_engine.get_metrics(db, portfolio.id)
    return PortfolioMetricsRead(**metrics)


@router.get("/insights/smart-money-overlap")
def get_smart_money_overlap(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Detect overlap between portfolio tokens and smart wallet activity."""
    portfolio = _get_or_create_portfolio(db, current_user.id)
    return detect_smart_money_overlap(db, portfolio.id)
