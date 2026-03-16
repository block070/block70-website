from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class OpportunityHistory(Base):
    """
    Snapshot of an opportunity's key metrics over time.

    Used for historical analysis and trend tracking.
    """

    __tablename__ = "opportunity_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    opportunity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )

    # Snapshot of the overall opportunity score at this point in time.
    score_snapshot: Mapped[float] = mapped_column(Float, nullable=False)

    # Snapshot of the estimated ROI (percent) at this point in time.
    roi_snapshot: Mapped[float] = mapped_column(Float, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

