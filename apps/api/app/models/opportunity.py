from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import (
    String,
    Float,
    DateTime,
    ForeignKey,
    Index,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class OpportunityStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    INACTIVE = "inactive"


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Core identity and classification
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    type: Mapped[str] = mapped_column(String(64), index=True)
    chain: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    status: Mapped[str] = mapped_column(
        String(32), index=True, default=OpportunityStatus.ACTIVE.value
    )

    # Narrative
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Asset metadata
    asset_symbol: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    base_symbol: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    quote_symbol: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Source & references
    source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    source_ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Estimates
    estimated_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_upside: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_roi_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Score components (0–1 normalized where applicable)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    upside_score: Mapped[float] = mapped_column(Float, default=0.0)
    freshness_score: Mapped[float] = mapped_column(Float, default=0.0)
    liquidity_score: Mapped[float] = mapped_column(Float, default=0.0)
    accessibility_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    difficulty_score: Mapped[float] = mapped_column(Float, default=0.0)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)

    # Human-readable levels
    risk_level: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    difficulty_level: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Lifecycle timestamps
    detected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Optional raw payload for explainability and deduplication
    dedup_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    raw_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    signals: Mapped[List["OpportunitySignal"]] = relationship(
        back_populates="opportunity",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index(
            "ix_opportunity_active_dedup",
            "dedup_key",
            "status",
            postgresql_where=(status == OpportunityStatus.ACTIVE.value),
        ),
    )


class OpportunitySignal(Base):
    __tablename__ = "opportunity_signals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    opportunity_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("opportunities.id"), nullable=True, index=True
    )

    signal_type: Mapped[str] = mapped_column(String(64), index=True)
    signal_value: Mapped[float] = mapped_column(Float)
    signal_weight: Mapped[float] = mapped_column(Float, default=1.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Existing fields used by the current Opportunity Engine are preserved
    source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    detected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    dedup_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    opportunity: Mapped[Optional[Opportunity]] = relationship(
        back_populates="signals"
    )

