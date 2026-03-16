from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.trading_strategy import TradingStrategy


class StrategyCondition(Base):
    __tablename__ = "strategy_conditions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    strategy_id: Mapped[int] = mapped_column(
        ForeignKey("trading_strategies.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    condition_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    condition_value: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    strategy: Mapped["TradingStrategy"] = relationship(
        "TradingStrategy",
        back_populates="conditions",
    )
