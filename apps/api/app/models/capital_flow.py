from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class CapitalFlow(Base):
    """
    Records movement of capital between tokens and chains.
    Answers: where is the money flowing?
    """

    __tablename__ = "capital_flows"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    source_asset: Mapped[str] = mapped_column(String(64), index=True)
    destination_asset: Mapped[str] = mapped_column(String(64), index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    chain: Mapped[str] = mapped_column(String(32), index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
