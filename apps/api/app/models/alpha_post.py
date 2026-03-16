from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.alpha_comment import AlphaComment
    from app.models.alpha_vote import AlphaVote


class AlphaPost(Base):
    """Community alpha post: trade_idea, signal, strategy, research."""

    __tablename__ = "alpha_posts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_symbol: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    chain: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    alpha_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

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

    user: Mapped["User"] = relationship("User", backref="alpha_posts")
    comments: Mapped[list["AlphaComment"]] = relationship(
        "AlphaComment",
        back_populates="post",
        cascade="all, delete-orphan",
    )
    votes: Mapped[list["AlphaVote"]] = relationship(
        "AlphaVote",
        back_populates="post",
        cascade="all, delete-orphan",
    )
