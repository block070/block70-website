from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Opportunity, OpportunityStatus, WalletProfile
from app.services.wallets import WalletPerformanceEngine


router = APIRouter(prefix="/api/v1/wallets", tags=["wallets"])


@router.get("/leaderboard")
def get_wallet_leaderboard(
    db: Session = Depends(get_db),
) -> List[dict]:
    """
    Return a Smart Wallet Leaderboard sorted by:
    - average_roi (descending)
    - win_rate (descending)
    - recent activity (number of recent wallet opportunities)

    Each row includes:
    - wallet_address
    - win_rate
    - average_roi
    - total_profit_usd
    - recent_opportunity_count
    """
    # Define "recent" as the last 7 days of wallet-type opportunities.
    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=7)

    # Subquery: count recent wallet opportunities per wallet address.
    recent_counts_subq = (
        db.query(
            Opportunity.asset_symbol.label("asset_symbol"),
            func.count(Opportunity.id).label("recent_opportunity_count"),
        )
        .filter(
            Opportunity.type == "wallet",
            Opportunity.status == OpportunityStatus.ACTIVE.value,
            Opportunity.detected_at.isnot(None),
            Opportunity.detected_at >= recent_cutoff,
        )
        .group_by(Opportunity.asset_symbol)
        .subquery()
    )

    # Join wallet profiles to their recent wallet opportunity counts.
    query = (
        db.query(
            WalletProfile.wallet_address,
            WalletProfile.win_rate,
            WalletProfile.average_roi,
            WalletProfile.total_profit_usd,
            func.coalesce(recent_counts_subq.c.recent_opportunity_count, 0).label(
                "recent_opportunity_count"
            ),
        )
        .outerjoin(
            recent_counts_subq,
            recent_counts_subq.c.asset_symbol == WalletProfile.wallet_address,
        )
    )

    # Sort by average ROI, then win rate, then recent opportunity count.
    rows = (
        query.order_by(
            WalletProfile.average_roi.desc(),
            WalletProfile.win_rate.desc(),
            func.coalesce(recent_counts_subq.c.recent_opportunity_count, 0).desc(),
        )
        .limit(100)
        .all()
    )

    return [
        {
            "wallet_address": row.wallet_address,
            "win_rate": row.win_rate,
            "average_roi": row.average_roi,
            "total_profit_usd": row.total_profit_usd,
            "recent_opportunity_count": row.recent_opportunity_count,
        }
        for row in rows
    ]


@router.get("/smart")
def get_smart_wallets(
    db: Session = Depends(get_db),
    chain: str | None = Query(default=None, description="Filter by chain"),
    limit: int = Query(default=100, ge=1, le=200),
) -> List[dict]:
    """Return smart wallets ordered by profitability and reputation score."""
    engine = WalletPerformanceEngine()
    wallets = engine.get_smart_wallets(db, chain=chain, limit=limit)
    if not wallets:
        # Fallback: return leaderboard data so UI has something
        return get_wallet_leaderboard(db)[:limit]
    return [
        {
            "id": w.id,
            "wallet_address": w.wallet_address,
            "chain": w.chain,
            "reputation_score": w.reputation_score,
            "profitability_score": w.profitability_score,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in wallets
    ]


@router.get("/{address}/performance")
def get_wallet_performance(
    address: str = Path(..., description="Wallet address"),
    db: Session = Depends(get_db),
) -> dict:
    """Return ROI, win rate, and token holdings for a wallet."""
    engine = WalletPerformanceEngine()
    perf = engine.get_performance(db, address)
    if perf is None:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return {
        "wallet_address": perf.wallet_address,
        "chain": perf.chain,
        "roi": perf.roi,
        "win_rate": perf.win_rate,
        "token_holdings": perf.token_holdings,
    }


@router.get("/{address}")
def get_wallet(
    address: str = Path(..., description="Wallet address"),
    db: Session = Depends(get_db),
) -> dict:
    """Return smart wallet or wallet profile by address."""
    engine = WalletPerformanceEngine()
    w = engine.get_wallet_by_address(db, address)
    if w is None:
        raise HTTPException(status_code=404, detail="Wallet not found")
    if hasattr(w, "reputation_score"):
        return {
            "id": getattr(w, "id", None),
            "wallet_address": w.wallet_address,
            "chain": w.chain,
            "reputation_score": getattr(w, "reputation_score", 0),
            "profitability_score": getattr(w, "profitability_score", 0),
            "created_at": getattr(w, "created_at", None),
        }
    return {
        "wallet_address": w.wallet_address,
        "chain": w.chain,
        "win_rate": getattr(w, "win_rate", 0),
        "average_roi": getattr(w, "average_roi", 0),
        "total_profit_usd": getattr(w, "total_profit_usd", 0),
        "total_trades": getattr(w, "total_trades", 0),
    }

