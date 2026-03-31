"""Adaptive weights, prediction outcome tracking, calibration (Phase F)."""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Literal

from app.services.connectors.coingecko_connector import fetch_coin_markets_row_by_id
from app.services.connectors.market_cache import market_cache_get, market_cache_set

logger = logging.getLogger(__name__)

_WEIGHTS_KEY = "ai_intel_adaptive_weights"
_PENDING_KEY = "ai_intel_prediction_pending"
_STATS_KEY = "ai_intel_signal_stats"
_CALIB_PROB = "ai_intel_calib_prob"
_DEFAULT_W = {
    "momentum": 0.20,
    "volume": 0.15,
    "narrative": 0.20,
    "breakout": 0.15,
    "whale": 0.15,
    "velocity": 0.10,
    "relative_strength": 0.05,
}
_W_MIN = 0.03
_W_MAX = 0.45
_EPS = 0.008


def load_adaptive_weights() -> dict[str, float]:
    raw = market_cache_get(_WEIGHTS_KEY, 86400)
    if not isinstance(raw, dict):
        return dict(_DEFAULT_W)
    out: dict[str, float] = dict(_DEFAULT_W)
    for k, v in raw.items():
        if k in out:
            try:
                out[k] = float(v)
            except (TypeError, ValueError):
                pass
    s = sum(out.values())
    if s <= 0:
        return dict(_DEFAULT_W)
    return {k: out[k] / s for k in sorted(out.keys())}


def save_adaptive_weights(w: dict[str, float]) -> None:
    clamped = {k: max(_W_MIN, min(_W_MAX, float(w.get(k, _DEFAULT_W[k])))) for k in _DEFAULT_W}
    s = sum(clamped.values())
    norm = {k: clamped[k] / s for k in clamped}
    market_cache_set(_WEIGHTS_KEY, 86400 * 7, norm)


def nudge_weights_from_outcome(success: bool, dominant_factors: list[str]) -> None:
    w = load_adaptive_weights()
    sign = _EPS if success else -_EPS
    for f in dominant_factors:
        if f in w:
            w[f] += sign
    save_adaptive_weights(w)


def enqueue_prediction_records(records: list[dict[str, Any]]) -> None:
    if not records:
        return
    data = market_cache_get(_PENDING_KEY, 86400 * 3) or {}
    pending: list[dict[str, Any]] = list(data.get("pending") or [])
    pending.extend(records)
    if len(pending) > 500:
        pending = pending[-500:]
    market_cache_set(_PENDING_KEY, 86400 * 3, {"pending": pending})


def build_prediction_record(
    *,
    asset: str,
    coingecko_id: str,
    price: float,
    probability: float,
    horizon: Literal["IMMEDIATE", "SHORT_TERM", "DEVELOPING"],
    stage: str,
    signals: list[str],
) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "asset": asset.upper(),
        "coingecko_id": coingecko_id,
        "ts": time.time(),
        "predicted_probability": probability,
        "predicted_horizon": horizon,
        "predicted_stage": stage,
        "signals_present": signals,
        "price_at_prediction": price,
        "status": "pending",
    }


def resolve_pending_outcomes() -> int:
    """Fetch prices for due pending records; update outcomes; return count resolved."""
    data = market_cache_get(_PENDING_KEY, 86400 * 3) or {}
    pending: list[dict[str, Any]] = list(data.get("pending") or [])
    if not pending:
        return 0
    now = time.time()
    horizons_sec = {"IMMEDIATE": 6 * 3600, "SHORT_TERM": 24 * 3600, "DEVELOPING": 72 * 3600}
    success_pct = {"IMMEDIATE": 2.0, "SHORT_TERM": 2.5, "DEVELOPING": 3.0}
    kept: list[dict[str, Any]] = []
    resolved = 0
    for rec in pending:
        if rec.get("status") != "pending":
            continue
        h = rec.get("predicted_horizon") or "SHORT_TERM"
        due = float(rec.get("ts", 0)) + horizons_sec.get(h, 86400)
        if now < due:
            kept.append(rec)
            continue
        cid = rec.get("coingecko_id") or ""
        row = fetch_coin_markets_row_by_id(str(cid)) if cid else None
        px_new = None
        if row and row.get("current_price") is not None:
            try:
                px_new = float(row["current_price"])
            except (TypeError, ValueError):
                px_new = None
        px0 = rec.get("price_at_prediction")
        if px_new is not None and px0 and float(px0) > 0:
            chg = (px_new - float(px0)) / float(px0) * 100.0
            thr = success_pct.get(h, 2.5)
            if chg >= thr:
                outcome = "success"
            elif chg <= -thr * 1.5:
                outcome = "failure"
            else:
                outcome = "neutral"
            rec["price_after_horizon"] = px_new
            rec["outcome"] = outcome
            rec["status"] = "closed"
            _update_stats_from_record(rec)
            if outcome in ("success", "failure"):
                record_calibration_observation(float(rec.get("predicted_probability", 50)), outcome == "success")
                nudge_weights_from_outcome(
                    outcome == "success",
                    list(rec.get("signals_present") or [])[:3],
                )
        else:
            rec["status"] = "expired_no_price"
        resolved += 1
    market_cache_set(_PENDING_KEY, 86400 * 3, {"pending": kept[-500:]})
    return resolved


def _update_stats_from_record(rec: dict[str, Any]) -> None:
    st = market_cache_get(_STATS_KEY, 86400 * 14) or {}
    sigs = rec.get("signals_present") or []
    ok = 1 if rec.get("outcome") == "success" else 0
    n = 1
    for s in sigs:
        key = str(s)
        cur = st.get(key) or {"ok": 0, "n": 0}
        cur["ok"] = int(cur.get("ok", 0)) + ok
        cur["n"] = int(cur.get("n", 0)) + n
        st[key] = cur
    combo = "+".join(sorted(str(x) for x in sigs[:3]))
    if combo:
        cur = st.get(combo) or {"ok": 0, "n": 0}
        cur["ok"] = int(cur.get("ok", 0)) + ok
        cur["n"] = int(cur.get("n", 0)) + n
        st[combo] = cur
    market_cache_set(_STATS_KEY, 86400 * 14, st)


def signal_reliability_multiplier(signal_name: str) -> float:
    st = market_cache_get(_STATS_KEY, 86400 * 14) or {}
    cur = st.get(signal_name) or {}
    n = int(cur.get("n", 0))
    ok = int(cur.get("ok", 0))
    if n < 5:
        return 1.0
    rate = ok / max(1, n)
    return 0.85 + 0.30 * rate


def calibrate_probability_display(raw_prob: float) -> float:
    """Simple bucket calibration from empirical store."""
    cal = market_cache_get(_CALIB_PROB, 86400 * 14) or {}
    shrink = float(cal.get("shrink", 1.0))
    bias = float(cal.get("bias", 0.0))
    x = raw_prob * shrink + bias
    return max(5.0, min(95.0, x))


def record_calibration_observation(predicted: float, success: bool) -> None:
    cal = market_cache_get(_CALIB_PROB, 86400 * 14) or {}
    bins: dict[str, dict[str, float]] = dict(cal.get("bins") or {})
    b = int(max(0, min(9, predicted // 10)))
    key = str(b)
    cur = bins.get(key) or {"ok": 0, "n": 0}
    cur["n"] = float(cur.get("n", 0)) + 1.0
    if success:
        cur["ok"] = float(cur.get("ok", 0)) + 1.0
    bins[key] = cur
    # shrink toward empirical if high bin overpredicts
    emp = []
    for bk, v in bins.items():
        if v.get("n", 0) >= 8:
            emp.append((float(bk) * 10 + 5, (v.get("ok", 0) / max(1.0, v.get("n", 1))) * 100))
    shrink = 1.0
    if len(emp) >= 2:
        hi = sum(1 for _, r in emp if r < 45) / max(1, len(emp))
        shrink = 0.92 if hi > 0.5 else 1.0
    market_cache_set(_CALIB_PROB, 86400 * 14, {"bins": bins, "shrink": shrink, "bias": cal.get("bias", 0.0)})


def model_insights_bullets() -> list[str]:
    st = market_cache_get(_STATS_KEY, 86400 * 14) or {}
    lines: list[str] = []
    for k, v in st.items():
        if "+" not in k or int(v.get("n", 0)) < 6:
            continue
        rate = 100.0 * float(v.get("ok", 0)) / max(1.0, float(v.get("n", 1)))
        lines.append(f"{k}: {rate:.0f}% hit rate (n={int(v['n'])})")
    lines.sort(key=len)
    return lines[:5]
