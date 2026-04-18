"""Daily roll-up of Upland search usage.

Redis is the hot store (see apps/web/lib/upland/rate-limit.ts). A nightly job
(see app/jobs/upland_usage_rollup.py) materializes the previous day's counters
here so we have durable history for analytics + fraud detection.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class UplandUsageDaily(Base):
    __tablename__ = "upland_usage_daily"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "day_utc", "metric", name="uq_upland_usage_user_day_metric"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_utc: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String(32), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tier: Mapped[str] = mapped_column(String(16), nullable=False, default="free")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
