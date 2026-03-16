"""
Data Retrieval Engine: fetch relevant platform data to answer AI search queries.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List

from sqlalchemy.orm import Session

from app.models import (
    Signal,
    Opportunity,
    CapitalFlow,
    MarketNarrative,
    AIInsight,
    RadarEvent,
    WalletProfile,
)
from app.services.ai.ai_query_processor import ProcessedQuery


@dataclass
class RetrievedData:
    """Aggregated data from platform sources for response generation."""
    signals: List[dict] = field(default_factory=list)
    opportunities: List[dict] = field(default_factory=list)
    capital_flows: List[dict] = field(default_factory=list)
    narratives: List[dict] = field(default_factory=list)
    ai_insights: List[dict] = field(default_factory=list)
    radar_events: List[dict] = field(default_factory=list)
    wallet_activity: List[dict] = field(default_factory=list)
    market_data: List[dict] = field(default_factory=list)


class DataRetrievalEngine:
    """
    Fetch relevant data from signals, wallet tracker, market data, narratives,
    opportunities, AI insights, and radar for use by the response generator.
    """

    def retrieve(
        self,
        db: Session,
        processed: ProcessedQuery,
        *,
        signals_limit: int = 15,
        opportunities_limit: int = 10,
        flows_limit: int = 10,
        narratives_limit: int = 10,
        insights_limit: int = 10,
        radar_limit: int = 10,
    ) -> RetrievedData:
        """Fetch data based on processed query sources and token."""
        out = RetrievedData()
        token = processed.token_symbol
        sources = set(processed.sources)

        if "signals" in sources:
            q = db.query(Signal).order_by(Signal.created_at.desc()).limit(signals_limit)
            if token:
                q = q.filter(Signal.token_symbol == token)
            for s in q.all():
                out.signals.append({
                    "id": s.id,
                    "token_symbol": s.token_symbol,
                    "signal_type": s.signal_type,
                    "title": s.title,
                    "confidence_score": float(s.confidence_score or 0),
                    "signal_strength": float(s.signal_strength or 0),
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                })

        if "opportunities" in sources:
            q = db.query(Opportunity).filter(Opportunity.status == "active").order_by(Opportunity.total_score.desc().nullslast()).limit(opportunities_limit)
            if token:
                q = q.filter(
                    (Opportunity.asset_symbol == token) | (Opportunity.base_symbol == token),
                )
            for o in q.all():
                out.opportunities.append({
                    "id": o.id,
                    "title": o.title,
                    "slug": o.slug,
                    "asset_symbol": o.asset_symbol,
                    "total_score": float(o.total_score or 0),
                    "estimated_roi_percent": o.estimated_roi_percent,
                })

        if "capital_flows" in sources:
            q = db.query(CapitalFlow).order_by(CapitalFlow.timestamp.desc()).limit(flows_limit)
            if token:
                q = q.filter(
                    (CapitalFlow.source_asset == token) | (CapitalFlow.destination_asset == token),
                )
            for f in q.all():
                out.capital_flows.append({
                    "source_asset": f.source_asset,
                    "destination_asset": f.destination_asset,
                    "amount": float(f.amount or 0),
                    "chain": f.chain,
                    "timestamp": f.timestamp.isoformat() if f.timestamp else None,
                })

        if "narratives" in sources:
            q = db.query(MarketNarrative).order_by(MarketNarrative.trend_score.desc().nullslast()).limit(narratives_limit).all()
            for n in q:
                out.narratives.append({
                    "name": n.name,
                    "description": n.description,
                    "trend_score": float(n.trend_score or 0),
                })

        if "ai_insights" in sources:
            q = db.query(AIInsight).order_by(AIInsight.created_at.desc()).limit(insights_limit * 2)
            rows = q.all()
            if token:
                rows = [i for i in rows if i.related_tokens and token in i.related_tokens][:insights_limit]
            else:
                rows = rows[:insights_limit]
            for i in rows:
                out.ai_insights.append({
                    "id": i.id,
                    "title": i.title,
                    "summary": i.summary,
                    "confidence_score": float(i.confidence_score or 0),
                    "related_tokens": i.related_tokens or [],
                })

        if "radar" in sources:
            q = db.query(RadarEvent).order_by(RadarEvent.created_at.desc()).limit(radar_limit)
            if token:
                q = q.filter(RadarEvent.token_symbol == token)
            for e in q.all():
                out.radar_events.append({
                    "token_symbol": e.token_symbol,
                    "event_type": e.event_type,
                    "severity_score": float(e.severity_score or 0),
                    "description": e.description,
                })

        if "wallet_activity" in sources:
            q = db.query(WalletProfile).order_by(WalletProfile.total_profit_usd.desc().nullslast()).limit(10).all()
            for w in q:
                out.wallet_activity.append({
                    "wallet_address": w.wallet_address,
                    "win_rate": float(w.win_rate or 0),
                    "total_profit_usd": w.total_profit_usd,
                })

        return out
