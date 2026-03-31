"""Ring buffer of rank snapshots for Δrank and freshness (Phase E)."""

from __future__ import annotations

import time
from typing import Any

from app.services.connectors.market_cache import market_cache_get, market_cache_set

_RING_TYP = "ai_intel_pattern_ring"
_RING_TTL = 86400
_MAX = 50


def push_rank_snapshot(ranks: dict[str, int]) -> None:
    payload = {"ts": time.time(), "ranks": ranks}
    data = market_cache_get(_RING_TYP, _RING_TTL) or {}
    snaps: list[dict[str, Any]] = list(data.get("snapshots") or [])
    snaps.append(payload)
    if len(snaps) > _MAX:
        snaps = snaps[-_MAX:]
    market_cache_set(_RING_TYP, _RING_TTL, {"snapshots": snaps})


def last_two_rank_maps() -> tuple[dict[str, int] | None, dict[str, int] | None]:
    data = market_cache_get(_RING_TYP, _RING_TTL) or {}
    snaps: list[dict[str, Any]] = list(data.get("snapshots") or [])
    if len(snaps) >= 2:
        return snaps[-2].get("ranks") or {}, snaps[-1].get("ranks") or {}
    if len(snaps) == 1:
        return None, snaps[-1].get("ranks") or {}
    return None, None


def rank_delta_for_symbol(symbol: str, current_rank: int) -> int:
    """Positive = moved up (rank number decreased). Previous rank index - current rank index."""
    prev_m, last_m = last_two_rank_maps()
    if prev_m is None or not last_m:
        return 0
    sym = symbol.upper()
    prev_r = prev_m.get(sym)
    if prev_r is None:
        return 0
    return prev_r - current_rank
