from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class AICopilotInsight(Base):
    """
    AI Copilot personalized insight for a user.
    Types: market_alert, portfolio_alert, opportunity_alert, narrative_alert.
    """

    __tablename__ = "ai_copilot_insights"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # market_alert | portfolio_alert | opportunity_alert | narrative_alert
    insight_type: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Optional: related token symbols, suggested actions (watch_token, set_alert, view_opportunity)
    related_tokens: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    suggested_actions: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", backref="copilot_insights")
    performance: Mapped["CopilotPerformance | None"] = relationship(
        "CopilotPerformance",
        back_populates="insight",
        uselist=False,
        cascade="all, delete-orphan",
    )


class CopilotPerformance(Base):
    """Track accuracy of AI Copilot insights for tuning and reporting."""

    __tablename__ = "copilot_performance"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    insight_id: Mapped[int] = mapped_column(
        ForeignKey("ai_copilot_insights.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

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

    insight: Mapped["AICopilotInsight"] = relationship(
        "AICopilotInsight",
        back_populates="performance",
    )
