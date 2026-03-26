from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class CryptoCategory(Base):
    """Dimension: official category_id slug from CoinGecko /coins/categories/list."""

    __tablename__ = "crypto_categories"

    slug: Mapped[str] = mapped_column(String(160), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CoinCryptoCategory(Base):
    """
    Many-to-many: coin belongs to one or more categories.
    rank_in_coin: 0 = primary (first in CoinGecko list order after dedupe).
    """

    __tablename__ = "coin_crypto_categories"

    coin_id: Mapped[int] = mapped_column(
        ForeignKey("coins.id", ondelete="CASCADE"),
        primary_key=True,
    )
    category_slug: Mapped[str] = mapped_column(
        String(160),
        ForeignKey("crypto_categories.slug", ondelete="CASCADE"),
        primary_key=True,
    )
    rank_in_coin: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="legacy")
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    coin = relationship("Coin", backref="category_links")


class CategoryAggregateSnapshot(Base):
    """Precomputed directory row for GET /api/v1/categories (no per-category CG fan-out)."""

    __tablename__ = "category_aggregate_snapshots"

    category_slug: Mapped[str] = mapped_column(
        String(160),
        ForeignKey("crypto_categories.slug", ondelete="CASCADE"),
        primary_key=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    market_cap: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    volume_24h: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    market_cap_change_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_block70: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_change_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    coin_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    top_coins_json: Mapped[str | None] = mapped_column(Text, nullable=True)
