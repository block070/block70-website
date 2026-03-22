"""
Exchange model – crypto exchanges from CoinGecko, with affiliate support.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Exchange(Base):
    __tablename__ = "exchanges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    trust_score_rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    trust_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    volume_24h_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    affiliate_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    image: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    year_established: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ExchangeClick(Base):
    __tablename__ = "exchange_clicks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exchange_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
