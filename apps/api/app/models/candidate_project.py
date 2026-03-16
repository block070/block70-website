from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class CandidateProject(Base):
    """
    Potential new crypto project detected by the Opportunity Hunter.

    Captures lightweight metadata and heuristic scores for follow-up
    evaluation and possible promotion into full Opportunities.
    """

    __tablename__ = "candidate_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    project_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    token_symbol: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    chain: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    source: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    dev_activity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    social_activity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

