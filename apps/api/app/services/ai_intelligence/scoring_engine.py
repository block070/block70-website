from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Literal, Mapping

Timeframe = Literal["24h", "7d"]

WEIGHTS: dict[str, float] = {
    "momentum": 0.20,
    "volume": 0.15,
    "social": 0.15,
    "dev": 0.10,
    "whales": 0.20,
    "sentiment": 0.10,
    "risk": 0.10,
}

# Extended hedge-fund composite (Phase C–E); sum should be 1.0
COMPOSITE_FACTOR_KEYS = (
    "momentum",
    "volume",
    "narrative",
    "breakout",
    "whale",
    "velocity",
    "relative_strength",
)


def compute_weighted_composite(
    components: dict[str, float],
    weights: dict[str, float],
) -> float:
    """Weighted 0–100 blend for extended alpha factors."""
    total = 0.0
    wsum = 0.0
    for k in COMPOSITE_FACTOR_KEYS:
        w = max(0.0, float(weights.get(k, 0.0)))
        c = _clamp(float(components.get(k, 50.0)))
        total += w * c
        wsum += w
    if wsum <= 0:
        return 50.0
    return _clamp(total / wsum)

PLACEHOLDER = 50.0


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def volatility_index_from_change(price_change_24h: float | None) -> float:
    """0 = calm, 100 = very volatile (abs move). Used for risk bucket filtering."""
    a = abs(price_change_24h or 0.0)
    return _clamp((a / 80.0) * 100.0)


@dataclass(frozen=True)
class CoinMarketInputs:
    symbol: str
    price_change_24h: float | None = None
    price_change_7d: float | None = None
    total_volume: float | None = None
    market_cap: float | None = None
    social_score: float | None = None
    dev_score: float | None = None
    whale_score: float | None = None
    sentiment_score: float | None = None
    news_sentiment: float | None = None

    @classmethod
    def from_coingecko_row(cls, row: Mapping[str, Any]) -> CoinMarketInputs:
        sym = (row.get("symbol") or row.get("Symbol") or "").strip()
        if isinstance(sym, str):
            sym = sym.upper()
        return cls(
            symbol=sym or "?",
            price_change_24h=_f(row.get("price_change_24h")),
            price_change_7d=_f(row.get("price_change_7d")),
            total_volume=_f(row.get("volume_24h") or row.get("total_volume")),
            market_cap=_f(row.get("market_cap")),
            social_score=_f(row.get("social_score")),
            dev_score=_f(row.get("dev_score")),
            whale_score=_f(row.get("whale_score")),
            sentiment_score=_f(row.get("sentiment_score")),
            news_sentiment=_f(row.get("news_sentiment")),
        )


def _f(v: Any) -> float | None:
    if v is None:
        return None
    try:
        x = float(v)
        return x if x == x else None
    except (TypeError, ValueError):
        return None


def _score_momentum(pct_24h: float | None, pct_7d: float | None, timeframe: Timeframe) -> float:
    pct = pct_7d if timeframe == "7d" else pct_24h
    if pct is None:
        return PLACEHOLDER
    x = (float(pct) + 35.0) / 70.0 * 100.0
    return _clamp(x)


def _score_volume(vol: float | None, mcap: float | None) -> float:
    if vol is None or mcap is None or mcap <= 0:
        return PLACEHOLDER
    turnover = vol / mcap
    lt = math.log10(max(turnover, 1e-8))
    s = (lt + 4.0) / 5.0 * 100.0
    return _clamp(s)


def _score_risk_low_volatility(price_change_24h: float | None) -> float:
    """Higher when 24h moves are small (inverse volatility)."""
    vi = volatility_index_from_change(price_change_24h)
    return _clamp(100.0 - vi)


def _resolve_optional(score: float | None) -> float:
    return PLACEHOLDER if score is None else _clamp(score)


def _to_signal_scale(component_0_100: float) -> float:
    return round((component_0_100 / 100.0) * 20.0, 3)


@dataclass(frozen=True)
class AlphaScoreResult:
    score: float
    components: dict[str, float]
    signals: dict[str, float]
    volatility_index: float


def compute_alpha_score(inputs: CoinMarketInputs, timeframe: Timeframe = "24h") -> AlphaScoreResult:
    mom = _score_momentum(inputs.price_change_24h, inputs.price_change_7d, timeframe)
    vol = _score_volume(inputs.total_volume, inputs.market_cap)
    soc = _resolve_optional(inputs.social_score)
    dev = _resolve_optional(inputs.dev_score)
    wh = _resolve_optional(inputs.whale_score)
    sent = _resolve_optional(inputs.sentiment_score if inputs.sentiment_score is not None else inputs.news_sentiment)
    risk = _score_risk_low_volatility(inputs.price_change_24h)

    components: dict[str, float] = {
        "momentum": mom,
        "volume": vol,
        "social": soc,
        "dev": dev,
        "whales": wh,
        "sentiment": sent,
        "risk": risk,
    }

    total = sum(WEIGHTS[k] * components[k] for k in WEIGHTS)
    total = _clamp(total)

    signals = {k: _to_signal_scale(components[k]) for k in WEIGHTS}

    vi = volatility_index_from_change(inputs.price_change_24h)

    return AlphaScoreResult(
        score=round(total, 3),
        components=components,
        signals=signals,
        volatility_index=round(vi, 3),
    )
