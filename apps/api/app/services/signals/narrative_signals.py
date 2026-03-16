from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Literal

from pydantic import BaseModel
from typing_extensions import TypedDict


class NarrativeRaw(BaseModel):
    """
    Raw narrative data for a token or narrative cluster.

    This is intentionally opinion-free and suitable for downstream signal
    extraction. Upstream connectors (social, dev activity, on-chain, price)
    should populate these fields in a normalized way.
    """

    token_symbol: str
    narrative: str  # e.g. "AI infra", "restaking", "BTC L2"

    # Social layer (normalized counts or scores over a recent window)
    social_mentions_24h: int
    social_mentions_change_24h: float  # percent change vs. prior 24h

    # Developer / protocol activity
    dev_commits_7d: int
    dev_activity_score: float  # 0–1 normalized

    # On-chain wallet behavior
    wallet_accumulation_usd_24h: float
    whale_wallet_count_24h: int

    # Price / liquidity
    price_change_24h_pct: float
    price_change_7d_pct: float
    volume_change_24h_pct: float

    detected_at: datetime


class NarrativeSignalValue(TypedDict):
    token_symbol: str
    narrative: str

    social_mentions_24h: int
    social_mentions_change_24h: float

    dev_commits_7d: int
    dev_activity_score: float

    wallet_accumulation_usd_24h: float
    whale_wallet_count_24h: int

    price_change_24h_pct: float
    price_change_7d_pct: float
    volume_change_24h_pct: float

    # Derived aggregates
    social_score: float
    dev_score: float
    accumulation_score: float
    momentum_score: float
    narrative_strength: float


class NarrativeSignal(BaseModel):
    """
    Structured narrative signal for trending tokens / narratives.
    """

    signal_type: Literal["narrative_trend"]
    value: NarrativeSignalValue
    confidence: float  # 0–1
    timestamp: datetime


class NarrativeSignalExtractor:
    """
    Converts raw narrative metrics into explicit narrative trend signals.

    Signals focus on:
    - social_mentions      -> social_score
    - dev_activity         -> dev_score
    - wallet_accumulation  -> accumulation_score
    - price_momentum       -> momentum_score

    Upstream connectors are responsible for providing NarrativeRaw items
    with consistent time windows (e.g. 24h / 7d).
    """

    def __init__(
        self,
        *,
        min_narrative_strength: float = 0.6,
    ) -> None:
        # Minimum composite narrative_strength required to emit a signal.
        self.min_narrative_strength = float(min_narrative_strength)

    def extract(self, raw_items: List[NarrativeRaw]) -> List[NarrativeSignal]:
        signals: List[NarrativeSignal] = []

        for raw in raw_items:
            # Social score: based on absolute mentions and acceleration.
            social_level = self._clamp(raw.social_mentions_24h / 5_000.0)
            social_trend = self._clamp(raw.social_mentions_change_24h / 100.0)
            social_score = self._clamp(0.6 * social_level + 0.4 * social_trend)

            # Dev score: normalized dev activity + commit volume.
            dev_volume = self._clamp(raw.dev_commits_7d / 100.0)
            dev_score = self._clamp(0.5 * raw.dev_activity_score + 0.5 * dev_volume)

            # Accumulation score: whale count and notional accumulation.
            accumulation_size = self._clamp(raw.wallet_accumulation_usd_24h / 5_000_000.0)
            accumulation_whales = self._clamp(raw.whale_wallet_count_24h / 25.0)
            accumulation_score = self._clamp(
                0.6 * accumulation_size + 0.4 * accumulation_whales
            )

            # Momentum score: blend of short- and mid-term price / volume moves.
            price_24h = self._clamp(max(raw.price_change_24h_pct, -50.0) / 50.0)
            price_7d = self._clamp(max(raw.price_change_7d_pct, -120.0) / 120.0)
            volume_24h = self._clamp(raw.volume_change_24h_pct / 200.0)
            momentum_score = self._clamp(
                0.45 * price_24h + 0.35 * price_7d + 0.2 * volume_24h
            )

            # Composite narrative strength – emphasize social + accumulation,
            # with dev and momentum as confirmation.
            narrative_strength = self._clamp(
                0.3 * social_score
                + 0.25 * accumulation_score
                + 0.25 * momentum_score
                + 0.2 * dev_score
            )

            if narrative_strength < self.min_narrative_strength:
                # Not strong enough to surface as a dedicated narrative signal.
                continue

            # Confidence is anchored in breadth of confirmation: when all four
            # sub-scores agree, confidence is high; if only one is strong,
            # confidence is lower even if narrative_strength passes threshold.
            mean_subscore = (social_score + dev_score + accumulation_score + momentum_score) / 4.0
            dispersion = max(
                abs(social_score - mean_subscore),
                abs(dev_score - mean_subscore),
                abs(accumulation_score - mean_subscore),
                abs(momentum_score - mean_subscore),
            )
            # Higher dispersion -> lower confidence.
            confidence = self._clamp(mean_subscore * (1.0 - dispersion * 0.5))

            value: NarrativeSignalValue = {
                "token_symbol": raw.token_symbol,
                "narrative": raw.narrative,
                "social_mentions_24h": raw.social_mentions_24h,
                "social_mentions_change_24h": raw.social_mentions_change_24h,
                "dev_commits_7d": raw.dev_commits_7d,
                "dev_activity_score": raw.dev_activity_score,
                "wallet_accumulation_usd_24h": raw.wallet_accumulation_usd_24h,
                "whale_wallet_count_24h": raw.whale_wallet_count_24h,
                "price_change_24h_pct": raw.price_change_24h_pct,
                "price_change_7d_pct": raw.price_change_7d_pct,
                "volume_change_24h_pct": raw.volume_change_24h_pct,
                "social_score": social_score,
                "dev_score": dev_score,
                "accumulation_score": accumulation_score,
                "momentum_score": momentum_score,
                "narrative_strength": narrative_strength,
            }

            signals.append(
                NarrativeSignal(
                    signal_type="narrative_trend",
                    value=value,
                    confidence=confidence,
                    timestamp=raw.detected_at.astimezone(timezone.utc),
                )
            )

        return signals

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

