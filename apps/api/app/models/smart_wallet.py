from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class SmartWallet(Base):
    """
    Smart money wallet profile: address, chain, and aggregated scores
    for reputation and profitability (used for leaderboards and tracking).
    """

    __tablename__ = "smart_wallets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    wallet_address: Mapped[str] = mapped_column(String(64), index=True)
    chain: Mapped[str] = mapped_column(String(32), default="solana", index=True)
    reputation_score: Mapped[float] = mapped_column(Float, default=0.0)
    profitability_score: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
