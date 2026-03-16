from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class Narrative(Base):
    __tablename__ = "narratives"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class CoinNarrative(Base):
    __tablename__ = "coin_narratives"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    coin_id: Mapped[int] = mapped_column(ForeignKey("coins.id"), index=True)
    narrative_id: Mapped[int] = mapped_column(ForeignKey("narratives.id"), index=True)

    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    coin = relationship("Coin", backref="coin_narratives")
    narrative = relationship("Narrative", backref="coin_mappings")

