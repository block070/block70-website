from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class BacktestResult(Base):
    """
    Historical backtest result for a specific Opportunity.

    Captures the token price at detection time and subsequent prices at
    1h, 24h, and 7d, along with derived ROI percentages and a simple
    success flag (roi_24h_percent > 0).
    """

    __tablename__ = "backtest_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    opportunity_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )

    token_symbol: Mapped[str] = mapped_column(String(32), index=True)

    price_at_detection: Mapped[float] = mapped_column(Float, nullable=False)
    price_after_1h: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_after_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_after_7d: Mapped[float | None] = mapped_column(Float, nullable=True)

    roi_1h_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi_24h_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    roi_7d_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    # True if roi_24h_percent > 0, False otherwise (can be set by the
    # backtesting job once data is available).
    success_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

