from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserStrategy(Base):
    __tablename__ = "user_strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_identifier: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
        doc="External user identifier (e.g. email, wallet address, or account ID).",
    )
    strategy_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Human-readable name for the strategy.",
    )
    conditions_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="JSON-encoded conditions describing the strategy logic.",
    )
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

