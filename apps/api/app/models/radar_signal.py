from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class RadarSignal(Base):
    """
    Crypto Radar signal emitted by various detectors (wallet, DEX, dev activity, social).

    These signals provide a lightweight, high-level view of what is moving in the
    market without being tied to a single Opportunity. They can be used to power
    radar UIs, watchlists, or narrative engines.
    """

    __tablename__ = "radar_signals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Classification of the signal, e.g.:
    # - wallet_accumulation
    # - dex_volume_spike
    # - liquidity_increase
    # - dev_activity_spike
    # - social_mentions_spike
    signal_type: Mapped[str] = mapped_column(String(64), index=True)

    token_symbol: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    chain: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    # Strength of the signal in [0,1], where higher means stronger.
    signal_strength: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Confidence in [0,1] that this radar signal is meaningful.
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Logical source, e.g. "WalletEngine", "DexMonitor", "GitHubActivity", "SocialScanner".
    source: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    # Free-form metadata payload with detector-specific details (addresses,
    # volumes, commit counts, etc.).
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

