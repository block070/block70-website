from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class AlphaSnapshot(Base):
    """
    Historical snapshot of the Alpha Ranking Engine output.

    Stores the alpha_score and rank_position for a given opportunity at
    a snapshot point (hourly / daily), enabling Block70 to reconstruct
    past alpha signals and leaderboards.
    """

    __tablename__ = "alpha_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    opportunity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )

    alpha_score: Mapped[float] = mapped_column(Float, nullable=False)

    # 1-based rank position at the time of snapshot (1 = top alpha).
    rank_position: Mapped[int] = mapped_column(Integer, nullable=False)

    # Snapshot granularity: "hourly" or "daily".
    snapshot_type: Mapped[str] = mapped_column(
        Enum("hourly", "daily", name="alpha_snapshot_type"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

