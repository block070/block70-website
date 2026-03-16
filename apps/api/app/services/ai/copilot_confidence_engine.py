"""
AI Copilot: calculate confidence scores for Copilot insights.
"""

from __future__ import annotations

from typing import Any

from app.services.ai.confidence_scoring import ConfidenceScoring, ConfidenceInputs


class CopilotConfidenceEngine:
    """
    Compute confidence scores for Copilot insights.
    Reuses ConfidenceScoring and adds Copilot-specific adjustments.
    """

    def __init__(self) -> None:
        self._scoring = ConfidenceScoring()

    def score_insight(
        self,
        *,
        insight_type: str,
        signal_count: int = 0,
        signal_strength_avg: float = 0.0,
        flow_volume_usd: float = 0.0,
        flow_count: int = 0,
        radar_severity_avg: float = 0.0,
        radar_count: int = 0,
        portfolio_relevance: float = 0.0,
    ) -> float:
        """
        Return a confidence score in [0, 1] for an insight.
        portfolio_relevance: 0-1, how relevant to the user's portfolio.
        """
        inputs = ConfidenceInputs(
            signal_strength_avg=signal_strength_avg,
            signal_count=signal_count,
            wallet_reputation_avg=0.0,
            wallet_count=0,
            flow_volume_usd=flow_volume_usd,
            flow_count=flow_count,
            radar_severity_avg=radar_severity_avg,
            radar_count=radar_count,
        )
        base = self._scoring.score(inputs)
        if portfolio_relevance > 0:
            base = min(1.0, base + 0.15 * portfolio_relevance)
        if insight_type == "portfolio_alert":
            base = min(1.0, base + 0.1)
        elif insight_type == "opportunity_alert":
            base = min(1.0, base + 0.05)
        return round(base, 3)

    def score_from_context(self, context: dict[str, Any]) -> float:
        """Compute confidence from a context dict (e.g. from analyzers)."""
        return self.score_insight(
            insight_type=context.get("insight_type", "market_alert"),
            signal_count=context.get("signal_count", 0),
            signal_strength_avg=context.get("signal_strength_avg", 0.0),
            flow_volume_usd=context.get("flow_volume_usd", 0.0),
            flow_count=context.get("flow_count", 0),
            radar_severity_avg=context.get("radar_severity_avg", 0.0),
            radar_count=context.get("radar_count", 0),
            portfolio_relevance=context.get("portfolio_relevance", 0.0),
        )
