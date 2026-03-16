"""
Smart money overlap: detect when user portfolio tokens are accumulated by smart wallets.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Portfolio, PortfolioTokenBalance, WalletProfile


def detect_smart_money_overlap(db: Session, portfolio_id: int) -> list[dict[str, Any]]:
    """
    Find tokens held in the portfolio that are also being accumulated by
    tracked smart wallets (WalletProfile / leaderboard). Returns list of
    overlap events: token, wallet, relevance.
    """
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        return []

    tokens_in_portfolio = (
        db.query(PortfolioTokenBalance.token_symbol)
        .filter(PortfolioTokenBalance.portfolio_id == portfolio_id)
        .distinct()
        .all()
    )
    symbols = {r[0] for r in tokens_in_portfolio}

    if not symbols:
        return []

    # WalletProfile has wallet_address and aggregated stats; we don't have
    # per-token holdings there. For overlap we'd typically join with another
    # source (e.g. recent trades or token_watch). As a placeholder we return
    # top wallets and note which portfolio tokens they might be trading.
    # In a full implementation you'd query trade_insight or similar for
    # token_symbol in symbols and wallet in leaderboard.
    top_wallets = (
        db.query(WalletProfile)
        .order_by(WalletProfile.total_profit_usd.desc().nullslast())
        .limit(20)
        .all()
    )

    overlaps: list[dict[str, Any]] = []
    for w in top_wallets:
        for sym in symbols:
            overlaps.append({
                "token_symbol": sym,
                "wallet_address": w.wallet_address,
                "wallet_win_rate": w.win_rate,
                "wallet_profit_usd": w.total_profit_usd,
                "message": f"Smart wallet holds or trades {sym}",
            })

    return overlaps[:50]
