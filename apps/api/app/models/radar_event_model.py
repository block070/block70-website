from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class RadarEvent(Base):
    """
    Persisted market radar anomaly event (volume spikes, liquidity changes,
    price breakouts). Used for the radar dashboard and alerts.
    """

    __tablename__ = "radar_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    token_symbol: Mapped[str] = mapped_column(String(32), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    severity_score: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
