"""Upland-scoped API keys (Elite tier only).

Separate from the global `api_keys` table so we can enforce a narrow scope
(only /api/v1/upland/* endpoints) without touching the main Developer Platform
flow. Key format: "upland_live_<32 random bytes base64url>".
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class UplandApiKey(Base):
    __tablename__ = "upland_api_keys"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    label: Mapped[str] = mapped_column(String(128), nullable=False)
    # Only the hash is stored; the plaintext is returned exactly once at creation.
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    key_prefix: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
