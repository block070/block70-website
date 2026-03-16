from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class OpportunityAnalysis(Base):
    """
    AI-generated analysis and explanation for a specific Opportunity.
    """

    __tablename__ = "opportunity_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    opportunity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    analysis_summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_factors: Mapped[str] = mapped_column(Text, nullable=True)
    risk_assessment: Mapped[str] = mapped_column(Text, nullable=True)
    confidence_explanation: Mapped[str] = mapped_column(Text, nullable=True)
    trade_strategy: Mapped[str] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

