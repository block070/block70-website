from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class SimulatedPortfolio(Base):
    """
    Simple simulated portfolio used for strategy and trade simulations.
    """

    __tablename__ = "simulated_portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    portfolio_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    starting_balance: Mapped[float] = mapped_column(Float, nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, nullable=False)

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

