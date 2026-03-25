"""Snap OHLCV bar open times to canonical timeframe boundaries (UTC)."""

from __future__ import annotations

from typing import Any

_TF_SEC = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
    "1w": 604800,
}


def align_ohlcv_bar_times(ohlcv: list[dict[str, Any]], timeframe: str) -> list[dict[str, Any]]:
    """Floor each bar to interval start; merge duplicate buckets (OHLCV rules)."""
    tf = (timeframe or "1h").lower().strip()
    sec = _TF_SEC.get(tf)
    if not sec or not ohlcv:
        return ohlcv

    sorted_bars = sorted(ohlcv, key=lambda b: int(b["time"]))
    buckets_items: dict[int, dict[str, Any]] = {}
    order_keys: list[int] = []

    for b in sorted_bars:
        t = int(b["time"])
        at = (t // sec) * sec
        o = float(b["open"])
        h = float(b["high"])
        low = float(b["low"])
        c = float(b["close"])
        vol = float(b.get("volume") or 0)
        if at not in buckets_items:
            buckets_items[at] = {
                "time": at,
                "open": o,
                "high": h,
                "low": low,
                "close": c,
                "volume": vol,
            }
            order_keys.append(at)
        else:
            cur = buckets_items[at]
            cur["high"] = max(cur["high"], h)
            cur["low"] = min(cur["low"], low)
            cur["close"] = c
            cur["volume"] = cur["volume"] + vol

    return [buckets_items[k] for k in sorted(order_keys)]
