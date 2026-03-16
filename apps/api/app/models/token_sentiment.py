"""
Token sentiment: user votes and aggregated summary per token.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class TokenSentimentVote(Base):
    """A single user vote for token sentiment: bullish, neutral, bearish."""

    __tablename__ = "token_sentiment_votes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    token_symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    sentiment: Mapped[str] = mapped_column(String(16), nullable=False)  # bullish | neutral | bearish

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "token_symbol", name="uq_user_token_sentiment"),
    )

    user: Mapped["User"] = relationship("User", backref="sentiment_votes")


class TokenSentimentSummary(Base):
    """Aggregated sentiment counts per token (updated by job or on vote)."""

    __tablename__ = "token_sentiment_summaries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    token_symbol: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)

    bullish_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    neutral_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bearish_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
