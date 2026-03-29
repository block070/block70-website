from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class WalletLedgerEvent(Base):
    """
    Normalized on-chain / indexed wallet events for whale intelligence feeds.
    Populated by batch jobs; optional until indexer wiring is complete.
    """

    __tablename__ = "wallet_ledger_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    chain: Mapped[str] = mapped_column(String(32), index=True)
    wallet_address: Mapped[str] = mapped_column(String(128), index=True)
    tx_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    event_type: Mapped[str] = mapped_column(
        String(32),
        default="other",
    )  # transfer | swap_in | swap_out | other
    token_symbol: Mapped[str | None] = mapped_column(String(64), nullable=True)
    amount_native: Mapped[float | None] = mapped_column(Float, nullable=True)
    amount_usd_est: Mapped[float | None] = mapped_column(Float, nullable=True)
    counterparty: Mapped[str | None] = mapped_column(String(128), nullable=True)
    raw_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
