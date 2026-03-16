from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.portfolio import Portfolio


class PortfolioTokenBalance(Base):
    __tablename__ = "portfolio_token_balances"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    portfolio_id: Mapped[int] = mapped_column(
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    token_symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    token_address: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    chain: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    value_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    portfolio: Mapped["Portfolio"] = relationship(
        "Portfolio",
        back_populates="token_balances",
    )
