from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class ExchangeAffiliateLink(Base):
    """
    Admin-configured URL template per exchange venue. When url_template is set and is_active,
    the web app uses it (with {slug}, {symbol}, {base} placeholders) instead of built-in defaults.
    """

    __tablename__ = "exchange_affiliate_links"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    venue_type: Mapped[str] = mapped_column(String(16), nullable=False, default="cex")
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    url_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
