"""
AI Copilot Engine: generate personalized insights for each user.
Inputs: portfolio tokens, tracked tokens, signals, wallet activity, capital flows, radar events.
Outputs: AICopilotInsight records and high-level insight payloads.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import (
    AICopilotInsight,
    Portfolio,
    PortfolioTokenBalance,
    TokenWatch,
    RadarEvent,
    UserNotification,
)
from app.services.ai.portfolio_analyzer import PortfolioAnalyzer, PortfolioAnalysisResult
from app.services.ai.opportunity_analyzer import OpportunityAnalyzer, DetectedOpportunity
from app.services.ai.narrative_copilot import NarrativeCopilot, NarrativeAlert
from app.services.ai.copilot_confidence_engine import CopilotConfidenceEngine


INSIGHT_TYPES = ("market_alert", "portfolio_alert", "opportunity_alert", "narrative_alert")


class CopilotEngine:
    """
    Generate personalized Copilot insights for a user from:
    - portfolio tokens
    - tracked tokens (TokenWatch)
    - signals, wallet activity, capital flows, radar events (via analyzers)
    """

    def __init__(self) -> None:
        self._portfolio_analyzer = PortfolioAnalyzer()
        self._opportunity_analyzer = OpportunityAnalyzer()
        self._narrative_copilot = NarrativeCopilot()
        self._confidence_engine = CopilotConfidenceEngine()

    def generate_insights(
        self,
        db: Session,
        user_id: int,
        *,
        max_insights: int = 25,
        min_confidence: float = 0.35,
    ) -> List[AICopilotInsight]:
        """
        Run full pipeline and persist AICopilotInsight rows for the user.
        Returns the newly created (or updated) insights.
        """
        portfolio_tokens = self._portfolio_tokens(db, user_id)
        tracked_tokens = self._tracked_tokens(db, user_id)

        insights: List[AICopilotInsight] = []

        # Portfolio alerts: risk, whale overlap, portfolio token radar
        analysis = self._portfolio_analyzer.analyze(db, user_id)
        for r in analysis.risk_concentrations:
            conf = self._confidence_engine.score_insight(
                insight_type="portfolio_alert",
                portfolio_relevance=1.0,
            )
            if conf >= min_confidence:
                insight = AICopilotInsight(
                    user_id=user_id,
                    insight_type="portfolio_alert",
                    title=f"Portfolio concentration: {r.token_symbol} ({r.allocation_pct:.0f}%)",
                    summary=f"Allocation in {r.token_symbol} is {r.risk_level} risk.",
                    confidence_score=conf,
                    related_tokens=[r.token_symbol],
                    suggested_actions=[{"action": "view_opportunity", "token": r.token_symbol}],
                )
                db.add(insight)
                insights.append(insight)
                if conf >= 0.6:
                    _notify_copilot(db, user_id, "portfolio_risk", insight.title, insight.summary)

        for w in analysis.whale_overlaps:
            conf = self._confidence_engine.score_insight(
                insight_type="portfolio_alert",
                portfolio_relevance=1.0,
            )
            if conf >= min_confidence:
                insight = AICopilotInsight(
                    user_id=user_id,
                    insight_type="portfolio_alert",
                    title=f"Whale / smart money overlap: {w.token_symbol}",
                    summary=w.description,
                    confidence_score=conf,
                    related_tokens=[w.token_symbol],
                    suggested_actions=[
                        {"action": "watch_token", "token": w.token_symbol},
                        {"action": "set_alert", "token": w.token_symbol},
                    ],
                )
                db.add(insight)
                insights.append(insight)
                if conf >= 0.6:
                    _notify_copilot(db, user_id, "whale_accumulation", insight.title, insight.summary)

        # Portfolio tokens that triggered radar events
        for symbol in portfolio_tokens:
            events = (
                db.query(RadarEvent)
                .filter(RadarEvent.token_symbol == symbol)
                .order_by(RadarEvent.created_at.desc())
                .limit(3)
                .all()
            )
            if events:
                severity_avg = sum(e.severity_score for e in events) / len(events)
                conf = self._confidence_engine.score_insight(
                    insight_type="portfolio_alert",
                    radar_count=len(events),
                    radar_severity_avg=severity_avg,
                    portfolio_relevance=1.0,
                )
                if conf >= min_confidence:
                    insight = AICopilotInsight(
                        user_id=user_id,
                        insight_type="portfolio_alert",
                        title=f"Portfolio token triggered radar: {symbol}",
                        summary=f"{events[0].event_type}: {events[0].description or 'Activity detected'}",
                        confidence_score=conf,
                        related_tokens=[symbol],
                        suggested_actions=[{"action": "view_opportunity", "token": symbol}],
                    )
                    db.add(insight)
                    insights.append(insight)

        # Opportunity alerts (filter by portfolio + tracked if desired)
        opportunities = self._opportunity_analyzer.detect(
            db,
            limit=max_insights,
            min_confidence=min_confidence,
        )
        relevant = [
            o
            for o in opportunities
            if o.token_symbol in portfolio_tokens or o.token_symbol in tracked_tokens or not portfolio_tokens
        ][:10]
        for o in relevant:
            insight = AICopilotInsight(
                user_id=user_id,
                insight_type="opportunity_alert",
                title=o.title,
                summary=o.summary,
                confidence_score=o.confidence,
                related_tokens=[o.token_symbol],
                suggested_actions=[
                    {"action": "watch_token", "token": o.token_symbol},
                    {"action": "view_opportunity", "token": o.token_symbol},
                ],
            )
            db.add(insight)
            insights.append(insight)
            if o.confidence >= 0.6:
                _notify_copilot(db, user_id, "high_confidence_opportunity", o.title, o.summary)

        # Narrative alerts
        narrative_alerts = self._narrative_copilot.get_alerts(db, limit=5)
        for na in narrative_alerts[:3]:
            insight = AICopilotInsight(
                user_id=user_id,
                insight_type="narrative_alert",
                title=f"Narrative: {na.narrative_name} ({na.direction})",
                summary=na.description or na.flow_summary or f"Trend score: {na.trend_score:.2f}",
                confidence_score=min(1.0, 0.3 + na.trend_score * 0.5),
                related_tokens=[],
                suggested_actions=[],
            )
            db.add(insight)
            insights.append(insight)

        if insights:
            db.commit()
            for i in insights:
                db.refresh(i)
        return insights[:max_insights]

    def get_portfolio_analysis(self, db: Session, user_id: int) -> PortfolioAnalysisResult:
        """Return portfolio analysis without persisting insights."""
        return self._portfolio_analyzer.analyze(db, user_id)

    def get_opportunities(
        self,
        db: Session,
        *,
        limit: int = 20,
        min_confidence: float = 0.3,
    ) -> List[DetectedOpportunity]:
        """Return detected opportunities (no user filter)."""
        return self._opportunity_analyzer.detect(db, limit=limit, min_confidence=min_confidence)

    def _portfolio_tokens(self, db: Session, user_id: int) -> List[str]:
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == user_id).first()
        if not portfolio:
            return []
        rows = (
            db.query(PortfolioTokenBalance.token_symbol)
            .filter(PortfolioTokenBalance.portfolio_id == portfolio.id)
            .distinct()
            .all()
        )
        return [r[0] for r in rows]

    def _tracked_tokens(self, db: Session, user_id: int) -> List[str]:
        # TokenWatch uses user_identifier (string). If we use user_id, cast.
        rows = (
            db.query(TokenWatch.token_symbol)
            .filter(TokenWatch.user_identifier == str(user_id))
            .distinct()
            .all()
        )
        return [r[0] for r in rows]


def _notify_copilot(
    db: Session,
    user_id: int,
    notification_type: str,
    title: str,
    summary: Optional[str] = None,
) -> None:
    """Create a UserNotification for Copilot alert (high-confidence opportunity, risk, whale)."""
    content = f"{title}. {summary or ''}"[:2000]
    n = UserNotification(
        user_id=user_id,
        notification_type=f"copilot_{notification_type}",
        content=content,
    )
    db.add(n)
