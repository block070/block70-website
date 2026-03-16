from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class MarketData(Base):
    __tablename__ = "market_data"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    coin_id: Mapped[int] = mapped_column(ForeignKey("coins.id"), index=True)
    coin = relationship("Coin", backref="market_data_points")

    price: Mapped[float] = mapped_column(Float, nullable=False)
    market_cap: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_change_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_change_7d: Mapped[float | None] = mapped_column(Float, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

