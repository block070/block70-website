from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.signal_bot import SignalBot
    from app.models.signal import Signal


class BotSignalEvent(Base):
    __tablename__ = "bot_signal_events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    signal_id: Mapped[int] = mapped_column(
        ForeignKey("signals.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    bot_id: Mapped[int] = mapped_column(
        ForeignKey("signal_bots.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="sent", index=True)

    signal: Mapped["Signal"] = relationship("Signal")
    bot: Mapped["SignalBot"] = relationship("SignalBot", backref="signal_events")
