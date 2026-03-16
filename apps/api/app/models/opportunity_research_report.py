from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class OpportunityResearchReport(Base):
    """
    Long-form, AI-generated research report for a specific Opportunity.

    Designed to feel like an internal research note with clear sections
    that can be rendered in the UI.
    """

    __tablename__ = "opportunity_research_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    opportunity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Full, serialized research note content (for example, a concatenation
    # of the sections below with headings). This allows downstream systems
    # to treat the report as a single blob when a structured view is not
    # required.
    report_content: Mapped[str] = mapped_column(Text, nullable=False)

    project_overview: Mapped[str] = mapped_column(Text, nullable=False)
    signal_analysis: Mapped[str] = mapped_column(Text, nullable=False)
    risk_factors: Mapped[str] = mapped_column(Text, nullable=False)
    potential_upside: Mapped[str] = mapped_column(Text, nullable=False)
    market_narrative: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

