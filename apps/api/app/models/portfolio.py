from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.portfolio_wallet import PortfolioWallet
    from app.models.portfolio_token_balance import PortfolioTokenBalance
    from app.models.portfolio_transaction import PortfolioTransaction


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    portfolio_name: Mapped[str] = mapped_column(String(128), nullable=False, default="Default")
    total_value_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_profit_loss: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

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

    wallets: Mapped[list["PortfolioWallet"]] = relationship(
        "PortfolioWallet",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )
    token_balances: Mapped[list["PortfolioTokenBalance"]] = relationship(
        "PortfolioTokenBalance",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )
    transactions: Mapped[list["PortfolioTransaction"]] = relationship(
        "PortfolioTransaction",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )
