"""
Technical indicators + Block70 composite chart score (0–100) and discrete signal.
"""

from __future__ import annotations

import math
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
    # first RSI average
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


def _pct_rank_rsi(rsi: float) -> float:
    """Map RSI to 0–100 bullish score (higher = more constructive for longs)."""
    # RSI 50 -> 50; oversold bounce zone 25–40 -> 60–75; overbought 70+ -> 35–45
    if rsi <= 50:
        return min(100.0, 50.0 + (50.0 - rsi) * 0.9)
    return max(0.0, 50.0 - (rsi - 50.0) * 0.8)


def _score_macd_hist(h: float, scale: float = 1e-4) -> float:
    """Normalize MACD histogram to ~0–100."""
    v = 50.0 + math.tanh(h / scale) * 35.0
    return max(0.0, min(100.0, v))


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


def _stdev_returns(closes: list[float], window: int = 20) -> float:
    if len(closes) < window + 1:
        return 0.0
    rets = []
    for i in range(len(closes) - window, len(closes)):
        if i <= 0:
            continue
        p0, p1 = closes[i - 1], closes[i]
        if p0 > 0:
            rets.append((p1 - p0) / p0)
    if len(rets) < 2:
        return 0.0
    m = sum(rets) / len(rets)
    var = sum((x - m) ** 2 for x in rets) / len(rets)
    return math.sqrt(var)


def signal_from_score(score: float) -> str:
    if score >= 80:
        return "Strong Buy"
    if score >= 65:
        return "Buy"
    if score >= 45:
        return "Hold"
    if score >= 30:
        return "Sell"
    return "Strong Sell"


def compute_indicators_for_ohlcv(
    ohlcv: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Input: list of {time, open, high, low, close, volume} sorted by time.
    Output: rsi/macd/ma series aligned by index + latest score, signal, markers.
    """
    closes = [float(b["close"]) for b in ohlcv]
    highs = [float(b["high"]) for b in ohlcv]
    lows = [float(b["low"]) for b in ohlcv]
    volumes = [float(b.get("volume") or 0) for b in ohlcv]
    times = [int(b["time"]) for b in ohlcv]

    rsi = _rsi_wilder(closes, 14)
    macd_line, macd_signal, macd_hist = _macd_hist(closes)
    ma50 = _ema_series(closes, 50)
    ma200 = _ema_series(closes, 200)
    vol_sma = _rolling_mean(volumes, 20)

    rsi_pts = [{"time": times[i], "value": rsi[i]} for i in range(len(times)) if rsi[i] is not None]
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
    ma50_pts = [{"time": times[i], "value": ma50[i]} for i in range(len(times)) if ma50[i] is not None]
    ma200_pts = [{"time": times[i], "value": ma200[i]} for i in range(len(times)) if ma200[i] is not None]

    # Per-bar component scores (last bar = headline)
    n = len(closes)
    comp_rsi: list[float] = []
    comp_macd: list[float] = []
    comp_vol: list[float] = []
    comp_mom: list[float] = []
    comp_ma: list[float] = []
    comp_volty: list[float] = []

    for i in range(n):
        r = rsi[i]
        rsi_s = _pct_rank_rsi(r) if r is not None else 50.0
        comp_rsi.append(rsi_s)

        h = macd_hist[i]
        comp_macd.append(_score_macd_hist(h * closes[i], scale=abs(closes[i]) * 1e-4 + 1e-8) if h is not None else 50.0)

        vs = vol_sma[i]
        v = volumes[i]
        if vs and vs > 0:
            ratio = v / vs
            comp_vol.append(min(100.0, 40.0 + min(ratio, 2.5) * 25.0))
        else:
            comp_vol.append(50.0)

        look = min(20, i)
        if look > 0 and closes[i - look] > 0:
            mom_pct = (closes[i] - closes[i - look]) / closes[i - look] * 100.0
            comp_mom.append(max(0.0, min(100.0, 50.0 + mom_pct * 2.5)))
        else:
            comp_mom.append(50.0)

        m50, m200 = ma50[i], ma200[i]
        c = closes[i]
        if m50 is not None and m200 is not None:
            above50 = c >= m50
            above200 = c >= m200
            if above50 and above200:
                comp_ma.append(75.0)
            elif not above50 and not above200:
                comp_ma.append(35.0)
            else:
                comp_ma.append(52.0)
        elif m50 is not None:
            comp_ma.append(65.0 if c >= m50 else 40.0)
        else:
            comp_ma.append(50.0)

        w = min(20, i + 1)
        st = _stdev_returns(closes[: i + 1], window=w) if w >= 5 else 0.02
        # Lower short-term vol -> slightly higher score
        volty_score = max(0.0, min(100.0, 85.0 - st * 1200.0))
        comp_volty.append(volty_score)

    weights = {"rsi": 0.20, "macd": 0.20, "vol": 0.15, "mom": 0.15, "ma": 0.15, "volty": 0.15}
    scores_series: list[float] = []
    for i in range(n):
        s = (
            comp_rsi[i] * weights["rsi"]
            + comp_macd[i] * weights["macd"]
            + comp_vol[i] * weights["vol"]
            + comp_mom[i] * weights["mom"]
            + comp_ma[i] * weights["ma"]
            + comp_volty[i] * weights["volty"]
        )
        scores_series.append(max(0.0, min(100.0, s)))

    headline = scores_series[-1] if scores_series else 50.0
    sig = signal_from_score(headline)

    # Markers: threshold crosses on score series
    markers: list[dict[str, Any]] = []
    hi, lo = 68.0, 38.0
    for i in range(1, n):
        prev, cur = scores_series[i - 1], scores_series[i]
        if prev < hi <= cur:
            markers.append({"time": times[i], "kind": "buy", "label": "Buy"})
        elif prev > lo >= cur:
            markers.append({"time": times[i], "kind": "sell", "label": "Sell"})
    # cap markers
    markers = markers[-24:]

    return {
        "rsi": rsi_pts,
        "macd": macd_pts,
        "ma50": ma50_pts,
        "ma200": ma200_pts,
        "score": round(headline, 1),
        "signal": sig,
        "markers": markers,
        "scores_series": [{"time": times[i], "value": scores_series[i]} for i in range(n)],
    }
