"""
Convert detected patterns and trends into human-readable insight titles and summaries.
"""

from __future__ import annotations

from typing import List

from app.services.ai.pattern_analyzer import DetectedPattern
from app.services.ai.trend_detector import DetectedTrend
from app.services.ai.narrative_analyzer import NarrativeMomentum


class InsightSummaryGenerator:
    """
    Convert patterns/trends into title + summary for AIInsight.
    Rule-based templates; can be extended with LLM later.
    """

    def from_pattern(self, p: DetectedPattern) -> tuple[str, str]:
        """Generate title and summary from a detected pattern."""
        if p.pattern_type == "coordinated_accumulation":
            title = "Smart wallets accumulating"
            summary = p.description
            if p.tokens:
                title = f"Smart wallets accumulated activity on {', '.join(p.tokens)}"
        elif p.pattern_type == "narrative_momentum":
            title = f"Narrative momentum: {p.metadata.get('narrative', 'Market')}"
            summary = p.description
        elif p.pattern_type == "market_rotation":
            title = "Capital rotation detected"
            summary = p.description
        else:
            title = "Market pattern detected"
            summary = p.description
        return title, summary

    def from_trend(self, t: DetectedTrend) -> tuple[str, str]:
        """Generate title and summary from a detected trend."""
        if t.trend_type == "signal_cluster":
            title = f"Signal cluster on {t.token_symbol or 'multiple tokens'}"
            summary = t.description
        elif t.trend_type == "capital_inflow":
            title = f"Capital inflow to {t.token_symbol or 'ecosystem'}"
            summary = t.description
        elif t.trend_type == "radar_activity":
            title = f"Volume spike on {t.token_symbol or 'tokens'}"
            summary = t.description
        else:
            title = "Emerging trend"
            summary = t.description
        return title, summary

    def from_narrative(self, n: NarrativeMomentum) -> tuple[str, str]:
        """Generate title and summary from narrative momentum."""
        title = f"Narrative: {n.name}"
        summary = n.description or f"Trend strength: {n.direction} ({n.trend_score:.0%})"
        return title, summary

    def example_wallet_insight(self, amount_usd: float, narrative: str) -> tuple[str, str]:
        """e.g. Smart wallets accumulated $12M of AI tokens in the past 24 hours."""
        if amount_usd >= 1e6:
            amount_str = f"${amount_usd / 1e6:.0f}M"
        elif amount_usd >= 1e3:
            amount_str = f"${amount_usd / 1e3:.0f}k"
        else:
            amount_str = f"${amount_usd:.0f}"
        title = f"Smart wallets accumulated {amount_str} of {narrative} tokens in the past 24 hours"
        summary = f"Narrative: {narrative}. Trend Strength: Rising."
        return title, summary

    def example_volume_flow_insight(
        self,
        depin_count: int,
        flow_description: str,
    ) -> tuple[str, str]:
        """e.g. Volume spike on 4 DePIN tokens; capital flows ETH → SOL."""
        title = f"Volume spike detected on {depin_count} DePIN tokens while capital flows {flow_description}"
        summary = f"Capital flows increased; {depin_count} tokens showed volume spikes."
        return title, summary
