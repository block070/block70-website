from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class SimulatedTrade(Base):
    """
    Simulated trade outcome for a specific Opportunity.

    Used to capture hypothetical entry/exit performance for backtesting or
    strategy simulation without representing a real executed trade.
    """

    __tablename__ = "simulated_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    opportunity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    token_symbol: Mapped[str] = mapped_column(String(32), index=True, nullable=False)

    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_price: Mapped[float] = mapped_column(Float, nullable=False)

    entry_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    exit_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    profit_percent: Mapped[float] = mapped_column(Float, nullable=False)
    profit_usd: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

