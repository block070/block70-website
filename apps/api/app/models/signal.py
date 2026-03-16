from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    signal_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    token_symbol: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    token_address: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    chain: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    signal_strength: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
