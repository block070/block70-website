from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.strategy_condition import StrategyCondition
    from app.models.strategy_backtest import StrategyBacktest
    from app.models.strategy_simulated_trade import StrategySimulatedTrade


class TradingStrategy(Base):
    __tablename__ = "trading_strategies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    strategy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    conditions_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    entry_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    exit_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", backref="trading_strategies")

    conditions: Mapped[list["StrategyCondition"]] = relationship(
        "StrategyCondition",
        back_populates="strategy",
        cascade="all, delete-orphan",
    )
    backtests: Mapped[list["StrategyBacktest"]] = relationship(
        "StrategyBacktest",
        back_populates="strategy",
        cascade="all, delete-orphan",
    )
    simulated_trades: Mapped[list["StrategySimulatedTrade"]] = relationship(
        "StrategySimulatedTrade",
        back_populates="strategy",
        cascade="all, delete-orphan",
    )
