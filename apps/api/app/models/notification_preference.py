from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class NotificationPreference(Base):
    """Per-user channel and topic toggles for email, push, and in-app marketing."""

    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    email_digest: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_realtime: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_marketing: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notify_opportunity: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_whale: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_narrative: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_signal: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_trial: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_reengage: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", backref="notification_preference", uselist=False)
