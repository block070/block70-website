from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LiquidityPool(Base):
    """
    DEX liquidity pool snapshot: pair, liquidity, volume, and fee tier.
    """

    __tablename__ = "liquidity_pools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    dex: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    pair: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    token_a: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    token_b: Mapped[str] = mapped_column(String(32), index=True, nullable=False)

    liquidity_usd: Mapped[float] = mapped_column(Float, nullable=False)
    volume_24h: Mapped[float] = mapped_column(Float, nullable=False)
    fee_percent: Mapped[float] = mapped_column(Float, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
