"""
Signal Scoring Engine.

Calculates signal_strength and confidence_score for signals based on:
- volume size
- wallet reputation
- market cap
- recency

Scores are in [0, 1]. The engine can score raw inputs or update existing
Signal-like objects.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


@dataclass
class ScoringFactors:
    """Input factors used to compute signal_strength and confidence_score."""

    volume_usd: Optional[float] = None
    wallet_reputation: Optional[float] = None  # 0–1
    market_cap_usd: Optional[float] = None
    recency_hours: Optional[float] = None  # hours since event
    base_strength: Optional[float] = None  # optional prior strength 0–1
    base_confidence: Optional[float] = None  # optional prior confidence 0–1


@dataclass
class ScoringResult:
    """Computed signal_strength and confidence_score in [0, 1]."""

    signal_strength: float
    confidence_score: float


class SignalScoringEngine:
    """
    Computes signal_strength and confidence_score from volume, wallet
    reputation, market cap, and recency. Weights are tunable.
    """

    def __init__(
        self,
        *,
        volume_weight: float = 0.30,
        wallet_reputation_weight: float = 0.25,
        market_cap_weight: float = 0.15,
        recency_weight: float = 0.30,
        volume_scale_usd: float = 2_000_000.0,
        mcap_scale_usd: float = 50_000_000.0,
        recency_half_life_hours: float = 12.0,
    ) -> None:
        self.volume_weight = volume_weight
        self.wallet_reputation_weight = wallet_reputation_weight
        self.market_cap_weight = market_cap_weight
        self.recency_weight = recency_weight
        self.volume_scale_usd = volume_scale_usd
        self.mcap_scale_usd = mcap_scale_usd
        self.recency_half_life_hours = recency_half_life_hours

    def _normalize_volume(self, volume_usd: Optional[float]) -> float:
        """Map volume to [0, 1] with soft cap at volume_scale_usd."""
        if volume_usd is None or volume_usd <= 0:
            return 0.0
        return min(1.0, volume_usd / self.volume_scale_usd)

    def _normalize_wallet_reputation(self, rep: Optional[float]) -> float:
        """Expect 0–1; clamp to [0, 1]."""
        if rep is None:
            return 0.0
        return max(0.0, min(1.0, float(rep)))

    def _normalize_market_cap(self, mcap_usd: Optional[float]) -> float:
        """
        Map market cap to [0, 1]. Larger cap can imply more confidence
        (established token) or less “edge”; we use a band so mid-cap
        is around 0.5 and very large cap caps at 1.
        """
        if mcap_usd is None or mcap_usd <= 0:
            return 0.0
        return min(1.0, mcap_usd / self.mcap_scale_usd)

    def _normalize_recency(self, recency_hours: Optional[float]) -> float:
        """
        Recency score: 0h -> 1.0, decays over time.
        Uses exponential-style decay with half-life.
        """
        if recency_hours is None or recency_hours < 0:
            return 0.0
        import math
        if recency_hours <= 0:
            return 1.0
        half = self.recency_half_life_hours
        return max(0.0, min(1.0, 0.5 ** (recency_hours / half)))

    def score(self, factors: ScoringFactors) -> ScoringResult:
        """
        Compute signal_strength and confidence_score from the given factors.

        - signal_strength: weighted combination of volume, recency, and
          optional base_strength (volume and recency emphasize “how strong
          and recent” the event is).
        - confidence_score: weighted combination of wallet_reputation,
          market_cap, recency, and optional base_confidence (reputation
          and mcap emphasize “how reliable” the signal is).
        """
        vol_n = self._normalize_volume(factors.volume_usd)
        rep_n = self._normalize_wallet_reputation(factors.wallet_reputation)
        mcap_n = self._normalize_market_cap(factors.market_cap_usd)
        rec_n = self._normalize_recency(factors.recency_hours)

        w_vol = self.volume_weight
        w_rep = self.wallet_reputation_weight
        w_mcap = self.market_cap_weight
        w_rec = self.recency_weight

        denom_s = w_vol + w_rec
        strength = (vol_n * w_vol + rec_n * w_rec) / denom_s if denom_s > 0 else (factors.base_strength or 0.0)
        if factors.base_strength is not None and denom_s > 0:
            strength = max(0.0, min(1.0, 0.6 * strength + 0.4 * factors.base_strength))

        denom_c = w_rep + w_mcap + w_rec
        confidence = (
            (rep_n * w_rep + mcap_n * w_mcap + rec_n * w_rec) / denom_c
            if denom_c > 0
            else (factors.base_confidence or 0.0)
        )
        if factors.base_confidence is not None and denom_c > 0:
            confidence = max(0.0, min(1.0, 0.6 * confidence + 0.4 * factors.base_confidence))

        return ScoringResult(
            signal_strength=round(strength, 4),
            confidence_score=round(confidence, 4),
        )

    def score_from_timestamp(
        self,
        event_time: Optional[datetime],
        *,
        volume_usd: Optional[float] = None,
        wallet_reputation: Optional[float] = None,
        market_cap_usd: Optional[float] = None,
        base_strength: Optional[float] = None,
        base_confidence: Optional[float] = None,
    ) -> ScoringResult:
        """Compute recency from event_time vs now and call score()."""
        recency_hours: Optional[float] = None
        if event_time is not None:
            now = datetime.now(timezone.utc)
            if event_time.tzinfo is None:
                event_time = event_time.replace(tzinfo=timezone.utc)
            recency_hours = max(0.0, (now - event_time).total_seconds() / 3600.0)
        return self.score(
            ScoringFactors(
                volume_usd=volume_usd,
                wallet_reputation=wallet_reputation,
                market_cap_usd=market_cap_usd,
                recency_hours=recency_hours,
                base_strength=base_strength,
                base_confidence=base_confidence,
            )
        )
