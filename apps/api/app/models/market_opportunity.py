from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class MarketOpportunity(Base):
    """
    Scanner opportunity: token, type, alpha score, confidence.
    Built from signals, wallet activity, capital flows, radar alerts.
    """

    __tablename__ = "market_opportunities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    token_symbol: Mapped[str] = mapped_column(String(32), index=True)
    opportunity_type: Mapped[str] = mapped_column(String(64), index=True)
    alpha_score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
