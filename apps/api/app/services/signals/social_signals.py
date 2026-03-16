from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal

from pydantic import BaseModel

from app.services.connectors.social_signal_connector import SocialActivityRaw


class SocialActivitySignal(BaseModel):
    """
    Structured social signal for a token or project.

    Signals focus on:
    - mention spikes
    - viral announcements / posts
    - rapid follower / engagement growth
    """

    signal_type: Literal[
        "social_mention_spike",
        "social_viral_announcement",
        "social_rapid_growth",
    ]
    token_symbol: str
    signal_strength: float  # 0–1
    confidence_score: float  # 0–1
    timestamp: datetime


class SocialSignalExtractor:
    """
    Converts normalized SocialActivityRaw records into explicit social
    activity signals.

    Heuristics (tunable):
    - mention_spike:
        - high absolute mention_count with decent engagement
    - viral_announcement:
        - very high engagement_score regardless of baseline mentions
    - rapid_growth:
        - combination of mentions and engagement treated as "growth" proxy

    In future iterations, this extractor can incorporate baselines
    (e.g. prior-day mentions) or follower counts when available.
    """

    def __init__(
        self,
        *,
        min_mentions_for_spike: int = 3_000,
        min_engagement_for_spike: float = 0.6,
        min_engagement_for_viral: float = 0.85,
        min_growth_threshold: float = 0.65,
    ) -> None:
        self.min_mentions_for_spike = int(min_mentions_for_spike)
        self.min_engagement_for_spike = float(min_engagement_for_spike)
        self.min_engagement_for_viral = float(min_engagement_for_viral)
        self.min_growth_threshold = float(min_growth_threshold)

    def extract(self, raw_items: List[SocialActivityRaw]) -> List[SocialActivitySignal]:
        signals: List[SocialActivitySignal] = []

        for raw in raw_items:
            ts = raw.timestamp.astimezone(timezone.utc)

            mentions = int(raw.mention_count)
            engagement = float(raw.engagement_score)

            # Mention spike: many mentions with reasonable engagement.
            if mentions >= self.min_mentions_for_spike and engagement >= self.min_engagement_for_spike:
                # Strength grows with both mentions and engagement.
                strength = self._clamp(
                    (mentions / 10_000.0) * 0.6 + engagement * 0.4
                )
                confidence = self._clamp(0.5 + strength * 0.5)
                signals.append(
                    SocialActivitySignal(
                        signal_type="social_mention_spike",
                        token_symbol=raw.token_symbol,
                        signal_strength=strength,
                        confidence_score=confidence,
                        timestamp=ts,
                    )
                )

            # Viral announcement: very high engagement regardless of raw count.
            if engagement >= self.min_engagement_for_viral:
                strength = self._clamp(engagement)
                confidence = self._clamp(0.7 + strength * 0.3)
                signals.append(
                    SocialActivitySignal(
                        signal_type="social_viral_announcement",
                        token_symbol=raw.token_symbol,
                        signal_strength=strength,
                        confidence_score=confidence,
                        timestamp=ts,
                    )
                )

            # Rapid growth proxy: blend of mention level and engagement.
            growth_score = self._clamp(
                (mentions / 8_000.0) * 0.5 + engagement * 0.5
            )
            if growth_score >= self.min_growth_threshold:
                confidence = self._clamp(0.5 + growth_score * 0.5)
                signals.append(
                    SocialActivitySignal(
                        signal_type="social_rapid_growth",
                        token_symbol=raw.token_symbol,
                        signal_strength=growth_score,
                        confidence_score=confidence,
                        timestamp=ts,
                    )
                )

        return signals

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

