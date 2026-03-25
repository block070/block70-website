"""
Technical indicators + Block70 composite chart score (0–100) and discrete signal.

Score uses a weighted checklist: RSI, MACD vs signal, SMA50 vs SMA200, volume trend,
7-bar momentum, and volatility (|momentum|) — aligned with the Block70 product spec.
"""

from __future__ import annotations

from typing import Any


def _ema_series(values: list[float], period: int) -> list[float | None]:
    if period <= 0 or not values:
        return [None] * len(values)
    k = 2.0 / (period + 1)
    out: list[float | None] = []
    ema: float | None = None
    for v in values:
        if ema is None:
            ema = v
        else:
            ema = (v - ema) * k + ema
        out.append(ema)
    return out


def _rsi_wilder(closes: list[float], period: int = 14) -> list[float | None]:
    n = len(closes)
    out: list[float | None] = [None] * n
    if n < period + 1:
        return out
    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, n):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0.0))
        losses.append(max(-d, 0.0))
    avg_g = sum(gains[:period]) / period
    avg_l = sum(losses[:period]) / period
    i = period
    rs = avg_g / avg_l if avg_l > 1e-12 else (100.0 if avg_g > 0 else 0.0)
    out[i] = 100.0 - (100.0 / (1.0 + rs))
    for j in range(period + 1, n):
        g = gains[j - 1]
        l = losses[j - 1]
        avg_g = (avg_g * (period - 1) + g) / period
        avg_l = (avg_l * (period - 1) + l) / period
        rs = avg_g / avg_l if avg_l > 1e-12 else (100.0 if avg_g > 0 else 0.0)
        out[j] = 100.0 - (100.0 / (1.0 + rs))
    return out


def _macd_hist(closes: list[float]) -> tuple[list[float | None], list[float | None], list[float | None]]:
    """Return macd_line, signal_line, histogram (all aligned to closes length)."""
    n = len(closes)
    ema12 = _ema_series(closes, 12)
    ema26 = _ema_series(closes, 26)
    macd_line: list[float | None] = [None] * n
    for i in range(n):
        e12, e26 = ema12[i], ema26[i]
        if e12 is not None and e26 is not None:
            macd_line[i] = e12 - e26
    macd_vals = [macd_line[i] if macd_line[i] is not None else 0.0 for i in range(n)]
    signal = _ema_series(macd_vals, 9)
    hist: list[float | None] = [None] * n
    for i in range(n):
        ml, sig = macd_line[i], signal[i]
        if ml is not None and sig is not None:
            hist[i] = ml - sig
    return macd_line, signal, hist


def _rolling_mean(arr: list[float], window: int) -> list[float | None]:
    out: list[float | None] = [None] * len(arr)
    if window <= 0:
        return out
    s = 0.0
    for i, v in enumerate(arr):
        s += v
        if i >= window:
            s -= arr[i - window]
        if i >= window - 1:
            out[i] = s / window
    return out


def _volume_trend_ratio(volumes: list[float], i: int) -> float:
    """Recent 10-bar avg volume / prior 10-bar avg (ending at index i)."""
    if i < 19:
        return 1.0
    recent = volumes[i - 9 : i + 1]
    prev = volumes[i - 19 : i - 9]
    ra = sum(recent) / len(recent)
    pb = sum(prev) / len(prev)
    return ra / pb if pb > 1e-12 else 1.0


def _momentum_7bar(closes: list[float], i: int) -> float:
    """(close[i] - close[i-6]) / close[i-6] — same window as JS `length-7` reference bar."""
    if i < 6:
        return 0.0
    prev = closes[i - 6]
    if prev <= 0:
        return 0.0
    return (closes[i] - prev) / prev


def _discrete_bar_score(
    rsi: float | None,
    macd_l: float | None,
    sig_l: float | None,
    ma50: float | None,
    ma200: float | None,
    vol_tr: float,
    mom: float,
) -> float:
    score = 0.0
    if rsi is not None:
        if rsi < 30:
            score += 20.0
        elif rsi < 60:
            score += 10.0
    if macd_l is not None and sig_l is not None:
        if macd_l > sig_l:
            score += 20.0
        else:
            score += 5.0
    else:
        score += 5.0
    if ma50 is not None and ma200 is not None:
        if ma50 > ma200:
            score += 15.0
        else:
            score += 5.0
    else:
        score += 5.0
    if vol_tr > 1.2:
        score += 15.0
    elif vol_tr > 1.0:
        score += 8.0
    if mom > 0.05:
        score += 15.0
    elif mom > 0.0:
        score += 8.0
    volat = abs(mom)
    if volat < 0.1:
        score += 10.0
    else:
        score += 5.0
    return float(min(100, round(score)))


def signal_from_score(score: float) -> str:
    if score >= 80:
        return "Strong Buy"
    if score >= 60:
        return "Buy"
    if score >= 40:
        return "Hold"
    if score >= 20:
        return "Sell"
    return "Strong Sell"


def compute_indicators_for_ohlcv(
    ohlcv: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Input: list of {time, open, high, low, close, volume} sorted by time.
    Output: rsi/macd/SMA series + discrete Block70 score, signal, markers.
    """
    closes = [float(b["close"]) for b in ohlcv]
    volumes = [float(b.get("volume") or 0) for b in ohlcv]
    times = [int(b["time"]) for b in ohlcv]

    rsi = _rsi_wilder(closes, 14)
    macd_line, macd_signal, macd_hist = _macd_hist(closes)
    ma50 = _rolling_mean(closes, 50)
    ma200 = _rolling_mean(closes, 200)

    rsi_pts = [{"time": times[i], "value": float(rsi[i])} for i in range(len(times)) if rsi[i] is not None]
    macd_pts = [
        {
            "time": times[i],
            "line": macd_line[i],
            "signal": macd_signal[i],
            "histogram": macd_hist[i],
        }
        for i in range(len(times))
        if macd_hist[i] is not None
    ]
    ma50_pts = [{"time": times[i], "value": float(ma50[i])} for i in range(len(times)) if ma50[i] is not None]
    ma200_pts = [{"time": times[i], "value": float(ma200[i])} for i in range(len(times)) if ma200[i] is not None]

    n = len(closes)
    scores_series: list[float] = []
    for i in range(n):
        vol_tr = _volume_trend_ratio(volumes, i)
        mom = _momentum_7bar(closes, i)
        s = _discrete_bar_score(
            rsi[i],
            macd_line[i],
            macd_signal[i],
            ma50[i],
            ma200[i],
            vol_tr,
            mom,
        )
        scores_series.append(s)

    headline = scores_series[-1] if scores_series else 50.0
    sig = signal_from_score(headline)

    hi, lo = 60.0, 40.0
    markers: list[dict[str, Any]] = []
    for i in range(1, n):
        prev, cur = scores_series[i - 1], scores_series[i]
        if prev < hi <= cur:
            markers.append({"time": times[i], "kind": "buy", "label": "Buy"})
        elif prev > lo >= cur:
            markers.append({"time": times[i], "kind": "sell", "label": "Sell"})
    markers = markers[-24:]

    vt_last = _volume_trend_ratio(volumes, n - 1) if n else 1.0
    mom_last = _momentum_7bar(closes, n - 1) if n else 0.0

    return {
        "rsi": rsi_pts,
        "macd": macd_pts,
        "ma50": ma50_pts,
        "ma200": ma200_pts,
        "score": round(headline, 1),
        "signal": sig,
        "markers": markers,
        "scores_series": [{"time": times[i], "value": scores_series[i]} for i in range(n)],
        "volume_trend": round(vt_last, 4),
        "momentum": round(mom_last, 6),
    }
