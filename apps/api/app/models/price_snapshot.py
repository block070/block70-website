from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class PriceSnapshot(Base):
    """
    Historical price snapshot for a token, used for backtesting and
    radar evaluation.
    """

    __tablename__ = "price_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    token_symbol: Mapped[str] = mapped_column(String(32), index=True)
    chain: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    price: Mapped[float] = mapped_column(Float, nullable=False)
    volume_24h: Mapped[float | None] = mapped_column(Float, nullable=True)
    market_cap: Mapped[float | None] = mapped_column(Float, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

