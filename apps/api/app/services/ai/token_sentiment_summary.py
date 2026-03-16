"""
AI-generated token sentiment summary from votes, signals, wallet activity, narratives.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from sqlalchemy.orm import Session

from app.models import (
    TokenSentimentSummary,
    Signal,
    TokenSentimentVote,
)


@dataclass
class TokenSentimentSummaryResult:
    """AI-style summary of token sentiment."""
    token_symbol: str
    summary_text: str
    bullish_pct: float
    neutral_pct: float
    bearish_pct: float
    signal_count: int
    avg_confidence: float


class TokenSentimentSummaryService:
    """
    Analyze sentiment votes, signals, and optional wallet/narrative data
    to produce a short summary for display (e.g. in ai-sentiment-summary component).
    """

    def generate_summary(
        self,
        db: Session,
        token_symbol: str,
        *,
        max_signal_lookback: int = 50,
    ) -> TokenSentimentSummaryResult | None:
        """Produce a text summary and stats for the token."""
        token_upper = token_symbol.strip().upper()
        summary = (
            db.query(TokenSentimentSummary)
            .filter(TokenSentimentSummary.token_symbol == token_upper)
            .first()
        )
        if not summary:
            return None

        total = summary.bullish_count + summary.neutral_count + summary.bearish_count
        if total == 0:
            return None

        bull_pct = (summary.bullish_count / total) * 100
        neutral_pct = (summary.neutral_count / total) * 100
        bear_pct = (summary.bearish_count / total) * 100

        signals = (
            db.query(Signal)
            .filter(Signal.token_symbol == token_upper)
            .order_by(Signal.created_at.desc())
            .limit(max_signal_lookback)
            .all()
        )
        signal_count = len(signals)
        avg_conf = (
            sum(float(s.confidence_score or 0) for s in signals) / len(signals)
            if signals else 0.0
        )

        if bull_pct >= 60:
            tone = "bullish"
        elif bear_pct >= 50:
            tone = "bearish"
        else:
            tone = "mixed"

        summary_text = (
            f"Community sentiment for {token_upper} is {tone} "
            f"({summary.bullish_count} bullish, {summary.neutral_count} neutral, {summary.bearish_count} bearish). "
        )
        if signal_count > 0:
            summary_text += (
                f"Recent signal activity: {signal_count} signals, "
                f"average confidence {avg_conf * 100:.0f}%."
            )

        return TokenSentimentSummaryResult(
            token_symbol=token_upper,
            summary_text=summary_text,
            bullish_pct=bull_pct,
            neutral_pct=neutral_pct,
            bearish_pct=bear_pct,
            signal_count=signal_count,
            avg_confidence=avg_conf,
        )
