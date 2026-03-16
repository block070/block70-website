from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.trading_strategy import TradingStrategy


class StrategySimulatedTrade(Base):
    """
    Simulated trade outcome for a TradingStrategy.
    """
    __tablename__ = "strategy_simulated_trades"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    strategy_id: Mapped[int] = mapped_column(
        ForeignKey("trading_strategies.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    token_symbol: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_price: Mapped[float] = mapped_column(Float, nullable=False)
    profit_percent: Mapped[float] = mapped_column(Float, nullable=False)
    entry_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exit_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    strategy: Mapped["TradingStrategy"] = relationship(
        "TradingStrategy",
        back_populates="simulated_trades",
    )
