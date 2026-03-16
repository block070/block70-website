"""
AI Copilot: detect opportunities from signals, capital flows, smart wallet activity.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Signal, CapitalFlow, SmartWallet, MarketOpportunity, RadarEvent


@dataclass
class DetectedOpportunity:
    """A single opportunity for the Copilot."""
    token_symbol: str
    source: str  # signal | capital_flow | smart_wallet | market_opportunity | radar
    title: str
    summary: str
    confidence: float


class OpportunityAnalyzer:
    """
    Detect potential opportunities using signals, capital flows, smart wallet activity.
    """

    def detect(
        self,
        db: Session,
        *,
        limit: int = 20,
        min_confidence: float = 0.3,
    ) -> List[DetectedOpportunity]:
        """Aggregate opportunities from all sources."""
        out: List[DetectedOpportunity] = []

        from_signals = self._from_signals(db, limit=limit, min_confidence=min_confidence)
        from_flows = self._from_capital_flows(db, limit=limit)
        from_market = self._from_market_opportunities(db, limit=limit, min_confidence=min_confidence)
        from_radar = self._from_radar(db, limit=limit)

        seen = set()
        for o in from_signals + from_flows + from_market + from_radar:
            key = (o.token_symbol, o.source, o.title[:50])
            if key not in seen:
                seen.add(key)
                out.append(o)
        return out[:limit]

    def _from_signals(
        self,
        db: Session,
        *,
        limit: int = 10,
        min_confidence: float = 0.3,
    ) -> List[DetectedOpportunity]:
        q = (
            db.query(Signal)
            .filter(
                Signal.token_symbol.isnot(None),
                Signal.confidence_score >= min_confidence,
            )
            .order_by(Signal.created_at.desc())
            .limit(limit * 2)
        )
        signals = q.all()
        by_token: dict[str, list] = {}
        for s in signals:
            sym = s.token_symbol or "UNKNOWN"
            by_token.setdefault(sym, []).append(s)
        out = []
        for sym, group in list(by_token.items())[:limit]:
            avg_conf = sum(s.confidence_score or 0 for s in group) / len(group)
            out.append(
                DetectedOpportunity(
                    token_symbol=sym,
                    source="signal",
                    title=group[0].title or f"Signal: {sym}",
                    summary=group[0].description or f"{len(group)} signal(s) for {sym}",
                    confidence=min(1.0, avg_conf),
                )
            )
        return out

    def _from_capital_flows(self, db: Session, *, limit: int = 5) -> List[DetectedOpportunity]:
        q = (
            db.query(
                CapitalFlow.destination_asset,
                func.sum(CapitalFlow.amount).label("total"),
                func.count(CapitalFlow.id).label("cnt"),
            )
            .filter(CapitalFlow.destination_asset.isnot(None))
            .group_by(CapitalFlow.destination_asset)
            .order_by(func.sum(CapitalFlow.amount).desc())
            .limit(limit)
        )
        out = []
        for row in q.all():
            sym = getattr(row, "destination_asset", None) or str(row[0])
            total = float(getattr(row, "total", 0) or row[1])
            cnt = int(getattr(row, "cnt", 0) or row[2])
            if sym and sym != "UNKNOWN":
                out.append(
                    DetectedOpportunity(
                        token_symbol=sym,
                        source="capital_flow",
                        title=f"Capital flow into {sym}",
                        summary=f"${total:,.0f} inflow ({cnt} flow(s))",
                        confidence=min(1.0, 0.3 + (total / 1e9) * 0.5),
                    )
                )
        return out

    def _from_market_opportunities(
        self,
        db: Session,
        *,
        limit: int = 10,
        min_confidence: float = 0.3,
    ) -> List[DetectedOpportunity]:
        q = (
            db.query(MarketOpportunity)
            .filter(MarketOpportunity.confidence_score >= min_confidence)
            .order_by(MarketOpportunity.alpha_score.desc())
            .limit(limit)
            .all()
        )
        return [
            DetectedOpportunity(
                token_symbol=mo.token_symbol,
                source="market_opportunity",
                title=f"Market opportunity: {mo.token_symbol}",
                summary=f"Type: {mo.opportunity_type}, alpha: {mo.alpha_score:.2f}",
                confidence=float(mo.confidence_score or 0),
            )
            for mo in q
        ]

    def _from_radar(self, db: Session, *, limit: int = 5) -> List[DetectedOpportunity]:
        q = (
            db.query(RadarEvent)
            .filter(
                RadarEvent.token_symbol.isnot(None),
                RadarEvent.severity_score >= 0.5,
            )
            .order_by(RadarEvent.created_at.desc())
            .limit(limit * 3)
            .all()
        )
        by_token: dict[str, RadarEvent] = {}
        for e in q:
            if e.token_symbol and e.token_symbol not in by_token:
                by_token[e.token_symbol] = e
        return [
            DetectedOpportunity(
                token_symbol=e.token_symbol,
                source="radar",
                title=f"Radar: {e.event_type} - {e.token_symbol}",
                summary=e.description or e.event_type,
                confidence=min(1.0, float(e.severity_score or 0)),
            )
            for e in list(by_token.values())[:limit]
        ]
