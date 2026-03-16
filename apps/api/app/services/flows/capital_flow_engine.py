"""
Capital flow engine: detect movement of capital between tokens and chains.

Inputs:
- wallet transactions
- DEX swaps
- bridge transfers
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import CapitalFlow


@dataclass
class WalletTx:
    """Stub for wallet transaction input."""
    source_asset: str
    destination_asset: str
    amount: float
    chain: str
    timestamp: Optional[datetime] = None


@dataclass
class DexSwap:
    """Stub for DEX swap input."""
    token_in: str
    token_out: str
    amount: float
    chain: str
    timestamp: Optional[datetime] = None


@dataclass
class BridgeTransfer:
    """Stub for bridge transfer input."""
    source_asset: str
    destination_asset: str
    amount: float
    source_chain: str
    dest_chain: str
    timestamp: Optional[datetime] = None


class CapitalFlowEngine:
    """
    Detects and persists capital flows from wallet transactions,
    DEX swaps, and bridge transfers. Supports querying by token and trending flows.
    """

    def ingest_wallet_tx(self, db: Session, tx: WalletTx) -> CapitalFlow:
        """Record a wallet transaction as a capital flow."""
        ts = tx.timestamp or datetime.now(timezone.utc)
        flow = CapitalFlow(
            source_asset=tx.source_asset,
            destination_asset=tx.destination_asset,
            amount=tx.amount,
            chain=tx.chain,
            timestamp=ts,
        )
        db.add(flow)
        db.commit()
        db.refresh(flow)
        return flow

    def ingest_dex_swap(self, db: Session, swap: DexSwap) -> CapitalFlow:
        """Record a DEX swap as a capital flow (token_in -> token_out)."""
        ts = swap.timestamp or datetime.now(timezone.utc)
        flow = CapitalFlow(
            source_asset=swap.token_in,
            destination_asset=swap.token_out,
            amount=swap.amount,
            chain=swap.chain,
            timestamp=ts,
        )
        db.add(flow)
        db.commit()
        db.refresh(flow)
        return flow

    def ingest_bridge_transfer(self, db: Session, transfer: BridgeTransfer) -> CapitalFlow:
        """Record a bridge transfer (single flow; chain stored as source_chain)."""
        ts = transfer.timestamp or datetime.now(timezone.utc)
        flow = CapitalFlow(
            source_asset=transfer.source_asset,
            destination_asset=transfer.destination_asset,
            amount=transfer.amount,
            chain=transfer.source_chain,
            timestamp=ts,
        )
        db.add(flow)
        db.commit()
        db.refresh(flow)
        return flow

    def list_flows(
        self,
        db: Session,
        *,
        chain: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[CapitalFlow]:
        """List capital flows with optional chain and time filter."""
        q = db.query(CapitalFlow)
        if chain:
            q = q.filter(CapitalFlow.chain == chain)
        if since:
            q = q.filter(CapitalFlow.timestamp >= since)
        q = q.order_by(CapitalFlow.timestamp.desc()).limit(limit)
        return list(q.all())

    def trending(
        self,
        db: Session,
        *,
        hours: int = 24,
        limit: int = 20,
    ) -> List[dict]:
        """
        Return trending flows: aggregated by (source_asset, destination_asset)
        with total amount and count over the last `hours`.
        """
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        sub = (
            db.query(
                CapitalFlow.source_asset,
                CapitalFlow.destination_asset,
                CapitalFlow.chain,
                func.sum(CapitalFlow.amount).label("total_amount"),
                func.count(CapitalFlow.id).label("flow_count"),
            )
            .filter(CapitalFlow.timestamp >= since)
            .group_by(
                CapitalFlow.source_asset,
                CapitalFlow.destination_asset,
                CapitalFlow.chain,
            )
            .order_by(func.sum(CapitalFlow.amount).desc())
            .limit(limit)
        )
        rows = sub.all()
        return [
            {
                "source_asset": r.source_asset,
                "destination_asset": r.destination_asset,
                "chain": r.chain,
                "total_amount": float(r.total_amount or 0),
                "flow_count": r.flow_count,
            }
            for r in rows
        ]

    def flows_for_token(
        self,
        db: Session,
        token: str,
        *,
        hours: int = 168,
        limit: int = 50,
    ) -> List[CapitalFlow]:
        """Return flows where the token is either source or destination."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        t = token.upper()
        q = (
            db.query(CapitalFlow)
            .filter(CapitalFlow.timestamp >= since)
            .filter(
                (CapitalFlow.source_asset == t) | (CapitalFlow.destination_asset == t)
            )
            .order_by(CapitalFlow.timestamp.desc())
            .limit(limit)
        )
        return list(q.all())
