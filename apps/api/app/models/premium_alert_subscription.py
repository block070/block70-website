from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class PremiumAlertSubscription(Base):
    """
    Subscription settings for premium alert delivery.

    Plan types:
    - free
    - pro
    - elite

    Elite users can receive near real-time alerts for the highest scoring
    opportunities as soon as they are detected.
    """

    __tablename__ = "premium_alert_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_identifier: Mapped[str] = mapped_column(String(255), index=True, nullable=False)

    # free, pro, elite
    plan_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    # List of alert types this subscription cares about (e.g. "alpha_alert",
    # "radar_event", "project_discovery").
    alert_types: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)

    # Minimum total_score / alpha_score threshold (0–100 scale) for alerts
    # routed via this subscription.
    minimum_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

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

