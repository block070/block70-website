from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.signal_bot import SignalBot


class BotAnalytics(Base):
    __tablename__ = "bot_analytics"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bot_id: Mapped[int] = mapped_column(
        ForeignKey("signal_bots.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    signals_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    bot: Mapped["SignalBot"] = relationship("SignalBot", backref="analytics")
