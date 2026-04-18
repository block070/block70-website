"""Per-product (Upland) entitlement record. Sits alongside Subscription.

A user can hold one global subscription (Subscription) AND an arbitrary number
of product-level add-on entitlements. Upland Pro and Upland Elite are the
first consumers of this table; future products (e.g. DAO Watcher) can reuse it.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class ProductEntitlement(Base):
    __tablename__ = "product_entitlements"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "product_key", name="uq_product_entitlements_user_product"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", backref="product_entitlements"
    )

    # product_key = "upland" (keep open so we can reuse for new verticals).
    product_key: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # tier = "pro" | "elite" (FREE is represented by row absence).
    tier: Mapped[str] = mapped_column(String(16), nullable=False, index=True)

    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_price_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)

    current_period_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    trial_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    canceled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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
