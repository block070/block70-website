from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class PageIndexStatus(Base):
    """
    Tracks whether a given URL path is indexed (as last observed).
    """

    __tablename__ = "page_index_status"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    path: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_status: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class PageTrafficMetric(Base):
    """
    Aggregated per-day traffic metrics for a URL path.
    """

    __tablename__ = "page_traffic_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    path: Mapped[str] = mapped_column(String(512), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)

    views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_visitors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

