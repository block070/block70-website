from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class ProjectTrend(Base):
    """
    Time-series snapshot of activity and confidence for a candidate project.

    Used to track how developer/social traction evolves over time so the
    Opportunity Hunter and downstream analytics can reason about trends
    rather than single snapshots.
    """

    __tablename__ = "project_trends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("candidate_projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    activity_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

