"""
Wallet performance engine: ROI, win rate, token holdings for smart wallets.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Opportunity, OpportunityStatus, SmartWallet, WalletProfile


@dataclass
class WalletPerformance:
    """Aggregated performance for a wallet."""
    wallet_address: str
    chain: str
    roi: float
    win_rate: float
    token_holdings: List[dict]  # [{ "symbol": str, "balance": float }]


class WalletPerformanceEngine:
    """
    Calculates ROI, win rate, and token holdings. Uses WalletProfile when
    available and SmartWallet for reputation/profitability scores.
    """

    def get_smart_wallets(
        self,
        db: Session,
        *,
        chain: Optional[str] = None,
        limit: int = 100,
    ) -> List[SmartWallet]:
        """Return smart wallets ordered by profitability_score then reputation_score."""
        q = db.query(SmartWallet)
        if chain:
            q = q.filter(SmartWallet.chain == chain)
        q = q.order_by(
            SmartWallet.profitability_score.desc(),
            SmartWallet.reputation_score.desc(),
        ).limit(limit)
        return list(q.all())

    def get_wallet_by_address(
        self,
        db: Session,
        address: str,
    ) -> Optional[SmartWallet | WalletProfile]:
        """
        Return SmartWallet or WalletProfile for the given address.
        Prefers SmartWallet if present, else falls back to WalletProfile.
        """
        smart = db.query(SmartWallet).filter(
            SmartWallet.wallet_address == address,
        ).first()
        if smart is not None:
            return smart
        profile = db.query(WalletProfile).filter(
            WalletProfile.wallet_address == address,
        ).first()
        return profile

    def get_performance(
        self,
        db: Session,
        address: str,
    ) -> Optional[WalletPerformance]:
        """
        Compute ROI, win rate, and token holdings for a wallet.
        Uses WalletProfile when available; token_holdings is placeholder
        (can be wired to portfolio/balances later).
        """
        profile = db.query(WalletProfile).filter(
            WalletProfile.wallet_address == address,
        ).first()
        if profile is None:
            smart = db.query(SmartWallet).filter(
                SmartWallet.wallet_address == address,
            ).first()
            if smart is None:
                return None
            return WalletPerformance(
                wallet_address=smart.wallet_address,
                chain=smart.chain,
                roi=smart.profitability_score,
                win_rate=0.0,
                token_holdings=[],
            )
        # Token holdings: not stored on WalletProfile; return empty or extend later
        return WalletPerformance(
            wallet_address=profile.wallet_address,
            chain=profile.chain,
            roi=profile.average_roi,
            win_rate=profile.win_rate,
            token_holdings=[],
        )

    def ensure_smart_wallet(
        self,
        db: Session,
        wallet_address: str,
        chain: str = "solana",
        reputation_score: float = 0.0,
        profitability_score: float = 0.0,
    ) -> SmartWallet:
        """Create or return existing SmartWallet; optionally sync from WalletProfile."""
        existing = db.query(SmartWallet).filter(
            SmartWallet.wallet_address == wallet_address,
        ).first()
        if existing is not None:
            return existing
        profile = db.query(WalletProfile).filter(
            WalletProfile.wallet_address == wallet_address,
        ).first()
        if profile is not None:
            profitability_score = profile.average_roi or profitability_score
            reputation_score = profile.win_rate or reputation_score
        w = SmartWallet(
            wallet_address=wallet_address,
            chain=chain,
            reputation_score=reputation_score,
            profitability_score=profitability_score,
        )
        db.add(w)
        db.commit()
        db.refresh(w)
        return w

    def get_wallet_activity_from_opportunities(
        self,
        db: Session,
        address: str,
        *,
        limit: int = 50,
    ) -> List[dict]:
        """
        Synthetic activity from wallet-type opportunities keyed by asset_symbol
        (or title/summary mention). Not a substitute for indexed DEX swaps.
        """
        key = (address or "").strip()
        if not key:
            return []
        key_lower = key.lower()
        q = (
            db.query(Opportunity)
            .filter(
                Opportunity.type == "wallet",
                Opportunity.status == OpportunityStatus.ACTIVE.value,
                or_(
                    func.lower(Opportunity.asset_symbol) == key_lower,
                    Opportunity.title.ilike(f"%{key}%"),
                    Opportunity.summary.ilike(f"%{key}%"),
                ),
            )
            .order_by(Opportunity.detected_at.desc().nullslast())
            .limit(limit)
        )
        rows = q.all()
        out: List[dict] = []
        for o in rows:
            out.append(
                {
                    "id": o.id,
                    "kind": "opportunity_signal",
                    "title": o.title,
                    "summary": (o.summary or "")[:500],
                    "total_score": float(o.total_score or 0.0),
                    "detected_at": o.detected_at.isoformat() if o.detected_at else None,
                    "asset_symbol": o.asset_symbol,
                    "chain": o.chain,
                }
            )
        return out
