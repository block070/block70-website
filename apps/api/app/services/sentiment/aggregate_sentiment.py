"""
Recompute TokenSentimentSummary for a token from TokenSentimentVote counts.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import TokenSentimentVote, TokenSentimentSummary


def update_summary_for_token(db: Session, token_symbol: str) -> TokenSentimentSummary:
    """Aggregate votes for token and upsert TokenSentimentSummary."""
    token_upper = token_symbol.upper().strip()
    rows = (
        db.query(TokenSentimentVote.sentiment, func.count(TokenSentimentVote.id))
        .filter(TokenSentimentVote.token_symbol == token_upper)
        .group_by(TokenSentimentVote.sentiment)
        .all()
    )
    counts = {"bullish": 0, "neutral": 0, "bearish": 0}
    for sentiment, cnt in rows:
        if sentiment in counts:
            counts[sentiment] = cnt

    summary = db.query(TokenSentimentSummary).filter(
        TokenSentimentSummary.token_symbol == token_upper,
    ).first()
    if summary:
        summary.bullish_count = counts["bullish"]
        summary.neutral_count = counts["neutral"]
        summary.bearish_count = counts["bearish"]
    else:
        summary = TokenSentimentSummary(
            token_symbol=token_upper,
            bullish_count=counts["bullish"],
            neutral_count=counts["neutral"],
            bearish_count=counts["bearish"],
        )
        db.add(summary)
    db.commit()
    db.refresh(summary)
    return summary
