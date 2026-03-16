from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class RewardAction(Base):
    __tablename__ = "reward_actions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    reward_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
