from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class RadarOutcome(Base):
    """
    Outcome record for a Radar event, used to evaluate prediction accuracy.

    Each row captures the price of a token at the time of a radar event and
    subsequent prices after 24h and 7d, along with a simple success flag.
    """

    __tablename__ = "radar_outcomes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Optionally link to a specific radar_event synthetic signal (if tracked).
    radar_event_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)

    token_symbol: Mapped[str] = mapped_column(String(32), index=True)

    price_at_event: Mapped[float] = mapped_column(Float, nullable=False)
    price_after_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_after_7d: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Simple success flag – can be defined as "price_after_7d > price_at_event"
    # or another rule decided by the evaluation job.
    prediction_success: Mapped[bool | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

