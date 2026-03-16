from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class TokenWatch(Base):
    """
    User-specific token watch, typically driven by Radar signals.

    Allows users to follow tokens that show up on the Crypto Radar so that
    later they can receive alerts or tailored views for those assets.
    """

    __tablename__ = "token_watch"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_identifier: Mapped[str] = mapped_column(String(255), index=True)
    token_symbol: Mapped[str] = mapped_column(String(32), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

