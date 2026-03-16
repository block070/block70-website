from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StreamEvent(Base):
    """
    Generic event record for the real-time streaming layer.

    Events are also pushed into Redis Streams for fan-out to multiple
    consumers, but we persist them here for observability and replay.
    """

    __tablename__ = "stream_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # e.g. price_update, wallet_transaction, dex_trade, liquidity_change, dev_activity, social_signal
    event_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)

    # Logical source of the event (connector or subsystem name).
    source: Mapped[str] = mapped_column(String(128), index=True, nullable=False)

    token_symbol: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)
    chain: Mapped[str | None] = mapped_column(String(32), index=True, nullable=True)

    # JSON-encoded payload with normalized event data.
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

