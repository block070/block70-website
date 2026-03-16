"""
AI Insight Engine: generate insights from platform data (signals, wallet activity,
radar alerts, capital flows, narrative trends). Persists AIInsight and InsightSource.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import AIInsight, InsightSource
from app.services.ai.confidence_scoring import ConfidenceInputs, ConfidenceScoring
from app.services.opportunities import OpportunityEngine
from app.services.ai.insight_summary_generator import InsightSummaryGenerator
from app.services.ai.narrative_analyzer import NarrativeAnalyzer, NarrativeMomentum
from app.services.ai.pattern_analyzer import DetectedPattern, PatternAnalyzer
from app.services.ai.trend_detector import DetectedTrend, TrendDetector


INSIGHT_TYPES = (
    "market_trend",
    "wallet_activity",
    "narrative_shift",
    "opportunity_alert",
)


class AIInsightEngine:
    """
    Generate insights from:
    - signals
    - wallet activity
    - radar alerts
    - capital flows
    - narrative trends
    """

    def __init__(self) -> None:
        self._pattern_analyzer = PatternAnalyzer()
        self._trend_detector = TrendDetector()
        self._narrative_analyzer = NarrativeAnalyzer()
        self._summary_gen = InsightSummaryGenerator()
        self._confidence = ConfidenceScoring()

    def generate_from_patterns(
        self,
        db: Session,
        *,
        token_symbol: Optional[str] = None,
        hours: int = 24,
    ) -> List[AIInsight]:
        """Generate insights from detected patterns (rotation, narrative momentum, accumulation)."""
        patterns = self._pattern_analyzer.run_all(db, token_symbol=token_symbol, hours=hours)
        insights = []
        for p in patterns:
            title, summary = self._summary_gen.from_pattern(p)
            insight_type = "market_trend" if p.pattern_type == "market_rotation" else "narrative_shift"
            if p.pattern_type == "coordinated_accumulation":
                insight_type = "wallet_activity"
            conf = self._confidence.score(
                ConfidenceInputs(
                    signal_strength_avg=p.strength,
                    flow_volume_usd=p.metadata.get("total_amount", 0) or 0,
                    flow_count=p.metadata.get("flow_count", 0) or 0,
                ),
            )
            insight = AIInsight(
                insight_type=insight_type,
                title=title[:512],
                summary=summary,
                related_tokens=p.tokens or None,
                confidence_score=conf,
            )
            db.add(insight)
            db.flush()
            db.add(
                InsightSource(
                    insight_id=insight.id,
                    source_type="capital_flows" if p.pattern_type == "market_rotation" else "signals",
                    source_id=f"pattern_{p.pattern_type}_{insight.id}",
                ),
            )
            insights.append(insight)
        if insights:
            db.commit()
            for i in insights:
                db.refresh(i)
        return insights

    def generate_from_trends(
        self,
        db: Session,
        *,
        hours: int = 24,
        limit: int = 5,
    ) -> List[AIInsight]:
        """Generate insights from detected trends (signal clusters, capital inflow, radar)."""
        trends = self._trend_detector.run_all(db, hours=hours, limit_per_type=limit)
        insights = []
        for t in trends[:10]:
            title, summary = self._summary_gen.from_trend(t)
            insight_type = "market_trend"
            if t.trend_type == "capital_inflow":
                insight_type = "opportunity_alert"
            conf = self._confidence.score(
                ConfidenceInputs(
                    signal_strength_avg=t.strength,
                    signal_count=t.signal_count,
                ),
            )
            insight = AIInsight(
                insight_type=insight_type,
                title=title[:512],
                summary=summary,
                related_tokens=[t.token_symbol] if t.token_symbol else None,
                confidence_score=conf,
            )
            db.add(insight)
            db.flush()
            db.add(
                InsightSource(
                    insight_id=insight.id,
                    source_type="signals" if t.trend_type == "signal_cluster" else "radar_events",
                    source_id=f"trend_{t.trend_type}_{insight.id}",
                ),
            )
            insights.append(insight)
            if insight_type == "opportunity_alert" and t.token_symbol and conf >= 0.5:
                try:
                    opp_engine = OpportunityEngine()
                    opp_engine.emit(
                        db,
                        token_symbol=t.token_symbol,
                        opportunity_type="ai_insight",
                        alpha_score=conf,
                        confidence_score=conf,
                    )
                except Exception:
                    pass
        if insights:
            db.commit()
            for i in insights:
                db.refresh(i)
        return insights

    def generate_from_narratives(
        self,
        db: Session,
        *,
        limit: int = 5,
    ) -> List[AIInsight]:
        """Generate insights from narrative momentum."""
        momentums = self._narrative_analyzer.top_momentum(db, limit=limit)
        insights = []
        for n in momentums:
            title, summary = self._summary_gen.from_narrative(n)
            insight = AIInsight(
                insight_type="narrative_shift",
                title=title[:512],
                summary=summary,
                related_tokens=None,
                confidence_score=n.trend_score,
            )
            db.add(insight)
            db.flush()
            db.add(
                InsightSource(
                    insight_id=insight.id,
                    source_type="signals",
                    source_id=f"narrative_{insight.id}",
                ),
            )
            insights.append(insight)
        if insights:
            db.commit()
            for i in insights:
                db.refresh(i)
        return insights

    def generate_example_insights(self, db: Session) -> List[AIInsight]:
        """Create example insights (e.g. for demo/seed)."""
        examples = [
            (
                "wallet_activity",
                "Smart wallets accumulated $12M of AI tokens in the past 24 hours",
                "Narrative: Artificial Intelligence. Trend Strength: Rising.",
                ["TAO", "RENDER", "FET", "AGIX"],
                0.85,
            ),
            (
                "market_trend",
                "Volume spike on 4 DePIN tokens while capital flows increased from ETH to SOL ecosystem",
                "Capital flows increased; 4 tokens showed volume spikes.",
                ["SOL", "ETH", "HNT", "RENDER"],
                0.78,
            ),
        ]
        insights = []
        for insight_type, title, summary, tokens, conf in examples:
            insight = AIInsight(
                insight_type=insight_type,
                title=title,
                summary=summary,
                related_tokens=tokens,
                confidence_score=conf,
            )
            db.add(insight)
            db.flush()
            db.add(
                InsightSource(
                    insight_id=insight.id,
                    source_type="signals",
                    source_id=f"example_{insight.id}",
                ),
            )
            insights.append(insight)
        if insights:
            db.commit()
            for i in insights:
                db.refresh(i)
        return insights

    def run(
        self,
        db: Session,
        *,
        token_symbol: Optional[str] = None,
        hours: int = 24,
        include_patterns: bool = True,
        include_trends: bool = True,
        include_narratives: bool = True,
    ) -> List[AIInsight]:
        """Run full insight generation pipeline."""
        out: List[AIInsight] = []
        if include_patterns:
            out.extend(self.generate_from_patterns(db, token_symbol=token_symbol, hours=hours))
        if include_trends:
            out.extend(self.generate_from_trends(db, hours=hours))
        if include_narratives:
            out.extend(self.generate_from_narratives(db))
        return out
