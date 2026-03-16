from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.trading_strategy import TradingStrategy


class StrategyBacktest(Base):
    __tablename__ = "strategy_backtests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    strategy_id: Mapped[int] = mapped_column(
        ForeignKey("trading_strategies.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    total_trades: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    win_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    average_profit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_drawdown: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    strategy: Mapped["TradingStrategy"] = relationship(
        "TradingStrategy",
        back_populates="backtests",
    )
