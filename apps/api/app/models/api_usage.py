from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.api_key import ApiKey


class ApiUsage(Base):
    __tablename__ = "api_usage"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    api_key_id: Mapped[int] = mapped_column(
        ForeignKey("api_keys.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    endpoint: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    api_key: Mapped["ApiKey"] = relationship("ApiKey", backref="usage_records")
