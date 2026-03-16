from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class DashboardWidget(Base):
    """
    Catalog of available dashboard widgets. default_position is React Grid
    Layout item shape: { i, x, y, w, h }.
    """

    __tablename__ = "dashboard_widgets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    widget_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    widget_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_position: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

