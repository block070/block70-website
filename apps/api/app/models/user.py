from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base

if TYPE_CHECKING:
    from app.models.user_dashboard_layout import UserDashboardLayout
    from app.models.portfolio import Portfolio
    from app.models.terms_acceptance import TermsAcceptance


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class PlanType(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    ELITE = "elite"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[str] = mapped_column(
        String(32),
        default=UserRole.USER.value,
        nullable=False,
        index=True,
    )
    plan_type: Mapped[str] = mapped_column(
        String(32),
        default=PlanType.FREE.value,
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    referral_code: Mapped[Optional[str]] = mapped_column(
        String(32),
        unique=True,
        index=True,
        nullable=True,
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

    dashboard_layout: Mapped[Optional["UserDashboardLayout"]] = relationship(
        "UserDashboardLayout",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    portfolios: Mapped[list["Portfolio"]] = relationship(
        "Portfolio",
        backref="user",
        cascade="all, delete-orphan",
    )
    terms_acceptance: Mapped[Optional["TermsAcceptance"]] = relationship(
        "TermsAcceptance",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

