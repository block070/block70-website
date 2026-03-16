from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class CandidateProjectAnalysis(Base):
    """
    AI-generated analysis for a CandidateProject.

    Captures a structured explanation of:
    - project purpose
    - signals detected
    - potential market impact
    - risk factors
    """

    __tablename__ = "candidate_project_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("candidate_projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    project_purpose: Mapped[str] = mapped_column(Text, nullable=False)
    signals_detected: Mapped[str] = mapped_column(Text, nullable=False)
    potential_market_impact: Mapped[str] = mapped_column(Text, nullable=False)
    risk_factors: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

