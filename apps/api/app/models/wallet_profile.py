from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class WalletProfile(Base):
    """
    Aggregated performance profile for a wallet used to adjust wallet
    opportunity scoring (confidence, risk) and power analytics views.
    """

    __tablename__ = "wallet_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Core identity
    wallet_address: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    chain: Mapped[str] = mapped_column(String(32), default="solana", index=True)

    # Trade-level aggregates
    total_trades: Mapped[int] = mapped_column(Integer, default=0)
    winning_trades: Mapped[int] = mapped_column(Integer, default=0)
    losing_trades: Mapped[int] = mapped_column(Integer, default=0)

    # High-level performance metrics
    win_rate: Mapped[float] = mapped_column(Float, default=0.0)
    average_roi: Mapped[float] = mapped_column(Float, default=0.0)
    total_profit_usd: Mapped[float] = mapped_column(Float, default=0.0)

    last_activity: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Legacy fields used by the scoring engine; kept in sync with the
    # analytics-oriented fields above.
    historical_success_rate: Mapped[float] = mapped_column(Float, default=0.5)
    avg_roi_percent: Mapped[float] = mapped_column(Float, default=0.0)
    avg_token_performance_percent: Mapped[float] = mapped_column(Float, default=0.0)

    total_signals: Mapped[int] = mapped_column(Integer, default=0)
    successful_signals: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

