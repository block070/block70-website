from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class AlphaEvent(Base):
    """
    High-level alpha feed event emitted by the Opportunity Engine.

    These events power the real-time activity feed and external integrations
    (e.g. Telegram, email digests) without exposing raw connector data.
    """

    __tablename__ = "alpha_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Event classification (e.g. arbitrage_detected, whale_buy, miner_roi_spike, trend_signal)
    event_type: Mapped[str] = mapped_column(String(64), index=True)

    # Optional token / chain context
    token_symbol: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    chain: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    # Short human-readable description suitable for feeds.
    summary: Mapped[str] = mapped_column(String(512))

    # Confidence in [0, 1] that this event is actionable.
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Logical source of the event (e.g. "ArbitrageAgent", "WalletAgent", "TrendEngine").
    source: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

