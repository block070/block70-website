"""Upland saved searches -- Pro+ users can persist filter combinations."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class UplandSavedSearch(Base):
    __tablename__ = "upland_saved_searches"
    __table_args__ = (
        Index("ix_upland_saved_searches_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", backref="upland_saved_searches"
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    filters: Mapped[dict] = mapped_column(JSON, nullable=False)
    alert_channel: Mapped[str] = mapped_column(String(16), nullable=False, default="none")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
