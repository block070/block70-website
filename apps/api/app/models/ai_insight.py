from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class AIInsight(Base):
    """
    AI-generated insight: market trend, wallet activity, narrative shift,
    or opportunity alert. Built from signals, wallet activity, radar, flows, narratives.
    """

    __tablename__ = "ai_insights"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # market_trend | wallet_activity | narrative_shift | opportunity_alert
    insight_type: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_tokens: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # ["SOL", "BONK"]
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    sources: Mapped[list["InsightSource"]] = relationship(
        "InsightSource",
        back_populates="insight",
        cascade="all, delete-orphan",
    )
    votes: Mapped[list["AIInsightVote"]] = relationship(
        "AIInsightVote",
        back_populates="insight",
        cascade="all, delete-orphan",
    )
    performance: Mapped["AIInsightPerformance | None"] = relationship(
        "AIInsightPerformance",
        back_populates="insight",
        uselist=False,
        cascade="all, delete-orphan",
    )


class InsightSource(Base):
    """Links an AI insight to its source (signals, wallet activity, radar events, capital flows)."""

    __tablename__ = "insight_sources"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insight_id: Mapped[int] = mapped_column(
        ForeignKey("ai_insights.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # signals | wallet_activity | radar_events | capital_flows
    source_type: Mapped[str] = mapped_column(String(64), index=True)
    source_id: Mapped[str] = mapped_column(String(128), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    insight: Mapped["AIInsight"] = relationship("AIInsight", back_populates="sources")


class AIInsightVote(Base):
    """User vote on an AI insight (e.g. helpful / not helpful)."""

    __tablename__ = "ai_insight_votes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insight_id: Mapped[int] = mapped_column(
        ForeignKey("ai_insights.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_identifier: Mapped[str] = mapped_column(String(255), index=True)
    vote: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 = up, -1 = down

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    insight: Mapped["AIInsight"] = relationship("AIInsight", back_populates="votes")


class AIInsightPerformance(Base):
    """Track how accurate an AI insight was (for tuning and reporting)."""

    __tablename__ = "ai_insight_performance"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insight_id: Mapped[int] = mapped_column(
        ForeignKey("ai_insights.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    # Outcome: was the insight correct? (filled after evaluation window)
    was_accurate: Mapped[bool | None] = mapped_column(nullable=True)
    outcome_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    evaluated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    insight: Mapped["AIInsight"] = relationship("AIInsight", back_populates="performance")
