from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class TrendingCoin(Base):
    __tablename__ = "trending_coins"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    coin_id: Mapped[int] = mapped_column(ForeignKey("coins.id"), index=True)
    coin = relationship("Coin", backref="trending_entries")

    trend_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

