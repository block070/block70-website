"""
Token sentiment API: vote and get aggregated sentiment per token.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_middleware import get_current_user
from app.db import get_db
from app.models import User, TokenSentimentVote, TokenSentimentSummary
from app.services.sentiment.aggregate_sentiment import update_summary_for_token
from app.services.ai.token_sentiment_summary import TokenSentimentSummaryService


router = APIRouter(prefix="/api/v1/sentiment", tags=["sentiment"])

VALID_SENTIMENTS = frozenset({"bullish", "neutral", "bearish"})


class SentimentVoteBody(BaseModel):
    token_symbol: str
    sentiment: str  # bullish | neutral | bearish


@router.post("/vote")
def vote(
    body: SentimentVoteBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """POST /api/v1/sentiment/vote — set or update user's sentiment for a token."""
    sentiment_lower = body.sentiment.strip().lower()
    if sentiment_lower not in VALID_SENTIMENTS:
        raise HTTPException(400, "sentiment must be one of: bullish, neutral, bearish")
    token_upper = body.token_symbol.strip().upper()
    if not token_upper:
        raise HTTPException(400, "token_symbol required")

    existing = (
        db.query(TokenSentimentVote)
        .filter(
            TokenSentimentVote.user_id == current_user.id,
            TokenSentimentVote.token_symbol == token_upper,
        )
        .first()
    )
    if existing:
        existing.sentiment = sentiment_lower
    else:
        db.add(
            TokenSentimentVote(
                user_id=current_user.id,
                token_symbol=token_upper,
                sentiment=sentiment_lower,
            )
        )
    db.commit()
    summary = update_summary_for_token(db, token_upper)
    return {
        "token_symbol": token_upper,
        "sentiment": sentiment_lower,
        "summary": {
            "bullish_count": summary.bullish_count,
            "neutral_count": summary.neutral_count,
            "bearish_count": summary.bearish_count,
            "updated_at": summary.updated_at.isoformat(),
        },
    }


@router.get("/trending")
def get_trending(
    db: Session = Depends(get_db),
    limit: int = 20,
) -> list[dict]:
    """GET /api/v1/sentiment/trending — tokens with strongest bullish sentiment (by bullish_count)."""
    from sqlalchemy import desc
    rows = (
        db.query(TokenSentimentSummary)
        .filter(
            (TokenSentimentSummary.bullish_count + TokenSentimentSummary.neutral_count + TokenSentimentSummary.bearish_count) > 0,
        )
        .order_by(desc(TokenSentimentSummary.bullish_count))
        .limit(limit)
        .all()
    )
    return [
        {
            "token_symbol": s.token_symbol,
            "bullish_count": s.bullish_count,
            "neutral_count": s.neutral_count,
            "bearish_count": s.bearish_count,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in rows
    ]


@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    limit: int = 50,
) -> list[dict]:
    """GET /api/v1/sentiment/leaderboard — rank tokens by bullish sentiment (bullish_count desc)."""
    rows = (
        db.query(TokenSentimentSummary)
        .filter(
            (TokenSentimentSummary.bullish_count + TokenSentimentSummary.neutral_count + TokenSentimentSummary.bearish_count) > 0,
        )
        .order_by(TokenSentimentSummary.bullish_count.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "rank": i + 1,
            "token_symbol": s.token_symbol,
            "bullish_count": s.bullish_count,
            "neutral_count": s.neutral_count,
            "bearish_count": s.bearish_count,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for i, s in enumerate(rows)
    ]


@router.get("/{token}/ai-summary")
def get_ai_sentiment_summary(
    token: str = Path(..., description="Token symbol"),
    db: Session = Depends(get_db),
) -> dict:
    """GET /api/v1/sentiment/{token}/ai-summary — AI-generated sentiment summary."""
    service = TokenSentimentSummaryService()
    result = service.generate_summary(db, token)
    if not result:
        token_upper = token.strip().upper()
        return {
            "token_symbol": token_upper,
            "summary_text": "No sentiment data yet for this token.",
            "bullish_pct": 0.0,
            "neutral_pct": 0.0,
            "bearish_pct": 0.0,
            "signal_count": 0,
            "avg_confidence": 0.0,
        }
    return {
        "token_symbol": result.token_symbol,
        "summary_text": result.summary_text,
        "bullish_pct": round(result.bullish_pct, 2),
        "neutral_pct": round(result.neutral_pct, 2),
        "bearish_pct": round(result.bearish_pct, 2),
        "signal_count": result.signal_count,
        "avg_confidence": round(result.avg_confidence, 4),
    }


@router.get("/{token}")
def get_sentiment(
    token: str = Path(..., description="Token symbol"),
    db: Session = Depends(get_db),
) -> dict:
    """GET /api/v1/sentiment/{token} — aggregated sentiment for a token."""
    token_upper = token.strip().upper()
    summary = (
        db.query(TokenSentimentSummary)
        .filter(TokenSentimentSummary.token_symbol == token_upper)
        .first()
    )
    if not summary:
        return {
            "token_symbol": token_upper,
            "bullish_count": 0,
            "neutral_count": 0,
            "bearish_count": 0,
            "updated_at": None,
        }
    return {
        "token_symbol": summary.token_symbol,
        "bullish_count": summary.bullish_count,
        "neutral_count": summary.neutral_count,
        "bearish_count": summary.bearish_count,
        "updated_at": summary.updated_at.isoformat() if summary.updated_at else None,
    }
