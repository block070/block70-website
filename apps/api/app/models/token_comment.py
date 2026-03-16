"""
Token discussion: comments and votes.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.user import User


class TokenComment(Base):
    """Community comment on a token."""

    __tablename__ = "token_comments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    token_symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    upvotes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", backref="token_comments")
    votes: Mapped[list["TokenCommentVote"]] = relationship(
        "TokenCommentVote",
        back_populates="comment",
        cascade="all, delete-orphan",
    )


class TokenCommentVote(Base):
    """Upvote on a token comment (one per user per comment)."""

    __tablename__ = "token_comment_votes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("token_comments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_comment_user_vote"),
    )

    comment: Mapped["TokenComment"] = relationship(
        "TokenComment",
        back_populates="votes",
    )
    user: Mapped["User"] = relationship("User", backref="token_comment_votes")
