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

from collections import defaultdict
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import CapitalFlow, Coin


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
        chain: Optional[str] = None,
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
        )
        if chain:
            sub = sub.filter(CapitalFlow.chain == chain)
        sub = (
            sub.group_by(
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

    def summary(
        self,
        db: Session,
        *,
        hours: int = 24,
        chain: Optional[str] = None,
        limit_destinations: int = 20,
        limit_categories: int = 20,
        limit_edges: int = 30,
        category_source_limit: int = 150,
    ) -> dict[str, Any]:
        """
        Macro snapshot: volume, by-chain, destination accumulators, category rollups
        (via Coin.symbol → Coin.category, unknown when no match), and hot edges.
        Category totals use the top ``category_source_limit`` destinations by volume
        (not full ledger) to keep queries bounded.
        """
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        lookup_limit = max(limit_destinations, category_source_limit)

        def _base_flow_filter(q):
            q = q.filter(CapitalFlow.timestamp >= since)
            if chain:
                q = q.filter(CapitalFlow.chain == chain)
            return q

        total_row = _base_flow_filter(
            db.query(func.coalesce(func.sum(CapitalFlow.amount), 0.0)),
        ).one()
        total_volume = float(total_row[0] or 0)

        by_chain_rows = (
            _base_flow_filter(
                db.query(
                    CapitalFlow.chain,
                    func.sum(CapitalFlow.amount).label("total_amount"),
                    func.count(CapitalFlow.id).label("flow_count"),
                )
            )
            .group_by(CapitalFlow.chain)
            .order_by(func.sum(CapitalFlow.amount).desc())
            .all()
        )
        by_chain = [
            {
                "chain": r.chain,
                "total_amount": float(r.total_amount or 0),
                "flow_count": int(r.flow_count or 0),
            }
            for r in by_chain_rows
        ]

        dest_rows = (
            _base_flow_filter(
                db.query(
                    CapitalFlow.destination_asset,
                    func.sum(CapitalFlow.amount).label("total_amount"),
                    func.count(CapitalFlow.id).label("flow_count"),
                )
            )
            .group_by(CapitalFlow.destination_asset)
            .order_by(func.sum(CapitalFlow.amount).desc())
            .limit(lookup_limit)
            .all()
        )
        top_destinations = [
            {
                "asset": r.destination_asset,
                "total_amount": float(r.total_amount or 0),
                "flow_count": int(r.flow_count or 0),
            }
            for r in dest_rows[:limit_destinations]
        ]

        sym_set = {r.destination_asset.upper() for r in dest_rows if r.destination_asset}
        cat_map: dict[str, str] = {}
        if sym_set:
            upper_syms = list(sym_set)
            coins = (
                db.query(Coin.symbol, Coin.category)
                .filter(func.upper(Coin.symbol).in_(upper_syms))
                .all()
            )
            for c in coins:
                if not c.symbol:
                    continue
                k = c.symbol.upper()
                if k in cat_map:
                    continue
                cat_map[k] = (c.category or "").strip() or "Unknown"

        by_cat_agg: dict[str, dict[str, float | int]] = defaultdict(
            lambda: {"total_amount": 0.0, "flow_count": 0}
        )
        for r in dest_rows:
            sym = (r.destination_asset or "").upper()
            label = cat_map.get(sym, "Unknown")
            bucket = by_cat_agg[label]
            bucket["total_amount"] = float(bucket["total_amount"]) + float(r.total_amount or 0)
            bucket["flow_count"] = int(bucket["flow_count"]) + int(r.flow_count or 0)

        by_category = sorted(
            (
                {
                    "category": name,
                    "total_amount": float(v["total_amount"]),
                    "flow_count": int(v["flow_count"]),
                }
                for name, v in by_cat_agg.items()
            ),
            key=lambda x: x["total_amount"],
            reverse=True,
        )[:limit_categories]

        hot_edges = self.trending(db, hours=hours, limit=limit_edges, chain=chain)

        dominant = by_chain[0] if by_chain else None

        return {
            "hours": hours,
            "chain_filter": chain,
            "total_volume": total_volume,
            "dominant_chain": dominant,
            "by_chain": by_chain,
            "by_category": by_category,
            "top_destinations": top_destinations,
            "hot_edges": hot_edges,
        }

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
