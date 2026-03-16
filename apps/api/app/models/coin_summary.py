from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class CoinSummary(Base):
    __tablename__ = "coin_summaries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    coin_id: Mapped[int] = mapped_column(ForeignKey("coins.id"), index=True)
    coin = relationship("Coin", backref="summaries")

    summary: Mapped[str] = mapped_column(Text, nullable=False)
    use_cases: Mapped[str] = mapped_column(Text, nullable=False)
    risk_factors: Mapped[str] = mapped_column(Text, nullable=False)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

