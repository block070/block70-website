from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.alpha_post import AlphaPost
    from app.models.user import User


class AlphaVote(Base):
    """Vote on an alpha post: upvote or downvote."""

    __tablename__ = "alpha_votes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    post_id: Mapped[int] = mapped_column(
        ForeignKey("alpha_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    vote_type: Mapped[str] = mapped_column(String(16), nullable=False)  # up, down

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    post: Mapped["AlphaPost"] = relationship("AlphaPost", back_populates="votes")
    user: Mapped["User"] = relationship("User", backref="alpha_votes")
