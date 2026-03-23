"""Persistent chart data – serve from DB first, APIs only for updates."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class ChartSnapshot(Base):
    """Cached price chart: [[ts_ms, price], ...]. Source: binance_us | coingecko."""

    __tablename__ = "chart_snapshots"
    __table_args__ = (UniqueConstraint("coin_slug", "days_param", "vs_currency", name="uq_chart_slug_days"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    coin_slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    days_param: Mapped[str] = mapped_column(String(16), nullable=False, index=True)  # "7", "30", "max"
    vs_currency: Mapped[str] = mapped_column(String(8), nullable=False, default="usd")
    prices_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="coingecko")  # binance_us | coingecko
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )
