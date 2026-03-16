from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class DailyBriefing(Base):
    """
    Stored daily intelligence briefing for Block70.

    Captures a high-level summary plus structured payloads for the day's
    top opportunities, tokens, and radar events.
    """

    __tablename__ = "daily_briefings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Human-readable daily summary (1–3 paragraphs).
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional structured payloads serialized as JSON for flexibility.
    # These can contain lists of IDs, denormalized objects, or display-ready
    # fragments as the product evolves.
    top_opportunities: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True
    )
    top_tokens: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    radar_events: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    market_sentiment: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

