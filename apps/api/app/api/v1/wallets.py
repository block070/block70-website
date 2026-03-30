from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user_optional
from app.core.plan_access import has_access, has_feature
from app.db import get_db
from app.models import Opportunity, OpportunityStatus, User, WalletLedgerEvent, WalletProfile
from app.services.auth.plan_access import resolve_effective_plan
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
    current_user: User | None = Depends(get_current_user_optional),
    chain: str | None = Query(default=None, description="Filter by chain"),
    limit: int = Query(default=100, ge=1, le=200),
) -> List[dict]:
    """Return smart wallets ordered by profitability and reputation score."""
    eff = resolve_effective_plan(db, current_user)
    if has_feature(eff, "opportunities_full"):
        eff_limit = min(limit, 200)
    elif has_access(eff, "pro"):
        eff_limit = min(limit, 45)
    else:
        eff_limit = min(limit, 12)
    engine = WalletPerformanceEngine()
    wallets = engine.get_smart_wallets(db, chain=chain, limit=eff_limit)
    if not wallets:
        # Fallback: return leaderboard data so UI has something
        return get_wallet_leaderboard(db)[:eff_limit]
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
    holdings = perf.token_holdings or []
    return {
        "wallet_address": perf.wallet_address,
        "chain": perf.chain,
        "roi": perf.roi,
        "win_rate": perf.win_rate,
        "token_holdings": holdings,
        "holdings_status": "available" if holdings else "unavailable",
        "holdings_note": "Balances are populated when indexer/RPC enrichment is wired; empty means not loaded.",
    }


@router.get("/{address}/activity")
def get_wallet_activity(
    address: str = Path(..., description="Wallet address"),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """Synthetic activity from wallet-type opportunities (not full DEX history)."""
    engine = WalletPerformanceEngine()
    items = engine.get_wallet_activity_from_opportunities(db, address, limit=limit)
    return {
        "wallet_address": address,
        "source": "opportunity_engine",
        "disclaimer": "Derived from Block70 wallet-type opportunities, not a canonical buy/sell ledger.",
        "items": items,
    }


@router.get("/{address}/events")
def get_wallet_ledger_events(
    address: str = Path(..., description="Wallet address"),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    chain: str | None = Query(default=None, description="Optional chain filter"),
) -> dict:
    """Indexed ledger events when `wallet_ledger_events` is populated; else empty."""
    try:
        q = db.query(WalletLedgerEvent).filter(
            WalletLedgerEvent.wallet_address == address,
        )
        if chain:
            q = q.filter(WalletLedgerEvent.chain == chain)
        rows = (
            q.order_by(WalletLedgerEvent.occurred_at.desc()).limit(limit).all()
        )
    except SQLAlchemyError:
        rows = []
    return {
        "wallet_address": address,
        "source": "ledger_indexer",
        "items": [
            {
                "id": r.id,
                "chain": r.chain,
                "tx_hash": r.tx_hash,
                "occurred_at": r.occurred_at.isoformat(),
                "event_type": r.event_type,
                "token_symbol": r.token_symbol,
                "amount_native": r.amount_native,
                "amount_usd_est": r.amount_usd_est,
                "counterparty": r.counterparty,
                "raw_summary": r.raw_summary,
            }
            for r in rows
        ],
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

