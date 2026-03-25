"""
Block70 chart pack: OHLCV + indicators + Redis/Postgres cache for /api/v1/chart.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import engine
from app.models.coin import Coin
from app.services.charts.binance_com import fetch_binance_com_klines
from app.services.charts.chart_service import get_ohlcv
from app.services.charts.indicators import compute_indicators_for_ohlcv
from app.services.charts.symbol_resolve import SLUG_TO_TICKER
from app.services.connectors.chart_cache import chart_cache_get, chart_cache_set

logger = logging.getLogger(__name__)

PACK_TIMEFRAMES = frozenset({"1m", "5m", "1h", "4h", "1d"})
PACK_REDIS_PREFIX = "pack:v1:"
PACK_REDIS_TTL = int(os.getenv("CHART_PACK_REDIS_TTL", "55"))


def resolve_ticker_slug(coin: str, db: Session | None) -> tuple[str, str]:
    """Return (ticker_upper, canonical_slug)."""
    raw_outer = (coin or "").strip()
    if not raw_outer:
        return "BTC", "bitcoin"
    low = raw_outer.lower()
    up = raw_outer.upper()
    if db:
        try:
            row = (
                db.query(Coin)
                .filter((Coin.slug == low) | (Coin.symbol == up))
                .first()
            )
            if row:
                return row.symbol.strip().upper(), row.slug.strip().lower()
        except Exception:
            pass
    slug = low
    t = SLUG_TO_TICKER.get(low)
    if t:
        return t, slug
    t2 = guess_ticker(up, low)
    return t2, slug


def _fetch_ohlcv_with_source(
    ticker: str, timeframe: str, limit: int
) -> tuple[list[dict[str, Any]], str]:
    tf = (timeframe or "1h").lower().strip()
    bn = fetch_binance_com_klines(ticker, tf)
    if bn:
        data = bn[-limit:] if len(bn) > limit else bn
        return data, "binance"
    data = get_ohlcv(ticker, tf, limit)
    if data:
        return data, "fallback_exchanges"
    slug_try = None
    for s, tick in SLUG_TO_TICKER.items():
        if tick == ticker.upper():
            slug_try = s
            break
    if slug_try:
        data = get_ohlcv(slug_try, tf, limit)
        if data:
            return data, "fallback_exchanges_slug"
    return [], "none"


def _persist_pack(slug: str, timeframe: str, payload: dict[str, Any]) -> None:
    try:
        js = json.dumps(payload, separators=(",", ":"))
        with engine.connect() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO chart_pack_snapshots (coin_slug, timeframe, pack_json, updated_at)
                    VALUES (:slug, :tf, :js, NOW())
                    ON CONFLICT (coin_slug, timeframe)
                    DO UPDATE SET pack_json = :js, updated_at = NOW()
                    """
                ),
                {"slug": slug, "tf": timeframe, "js": js},
            )
            conn.commit()
    except Exception as e:
        logger.debug("chart pack persist skipped: %s", e)


def build_chart_pack(
    coin: str,
    timeframe: str,
    db: Session | None = None,
    *,
    limit: int = 300,
    write_redis: bool = True,
    write_pg: bool = True,
) -> dict[str, Any]:
    tf = (timeframe or "1h").lower().strip()
    if tf not in PACK_TIMEFRAMES:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    ticker, slug = resolve_ticker_slug(coin, db)
    ohlcv, source = _fetch_ohlcv_with_source(ticker, tf, limit)
    if not ohlcv:
        empty = {
            "ohlc": [],
            "volume": [],
            "indicators": {
                "rsi": [],
                "macd": [],
                "score": None,
                "signal": "Hold",
                "markers": [],
            },
            "meta": {"slug": slug, "timeframe": tf, "ticker": ticker, "source": source},
        }
        if write_redis:
            chart_cache_set(PACK_REDIS_PREFIX + f"{slug}:{tf}", empty, 15)
        return empty

    ind = compute_indicators_for_ohlcv(ohlcv)
    payload: dict[str, Any] = {
        "ohlc": ohlcv,
        "volume": [{"time": int(b["time"]), "value": float(b.get("volume") or 0)} for b in ohlcv],
        "indicators": {
            "rsi": ind["rsi"],
            "macd": ind["macd"],
            "ma50": ind.get("ma50", []),
            "ma200": ind.get("ma200", []),
            "score": ind["score"],
            "signal": ind["signal"],
            "markers": ind["markers"],
        },
        "meta": {"slug": slug, "timeframe": tf, "ticker": ticker, "source": source},
    }
    if write_redis:
        chart_cache_set(PACK_REDIS_PREFIX + f"{slug}:{tf}", payload, PACK_REDIS_TTL)
    if write_pg:
        _persist_pack(slug, tf, payload)
    return payload


def get_chart_pack_cached(
    coin: str,
    timeframe: str,
    db: Session | None = None,
) -> dict[str, Any]:
    tf = (timeframe or "1h").lower().strip()
    if tf not in PACK_TIMEFRAMES:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    _, slug = resolve_ticker_slug(coin, db)
    key = PACK_REDIS_PREFIX + f"{slug}:{tf}"
    hit = chart_cache_get(key)
    if hit and isinstance(hit, dict) and "ohlc" in hit:
        return hit
    return build_chart_pack(coin, tf, db=db, write_redis=True, write_pg=True)


def refresh_chart_packs_for_slugs(slugs: list[str], timeframes: list[str]) -> None:
    """Scheduler: warm Redis + Postgres without request-scoped DB (slug map fallback)."""
    for raw in slugs:
        s = (raw or "").strip().lower()
        if not s:
            continue
        for tf in timeframes:
            tf = tf.lower().strip()
            if tf not in PACK_TIMEFRAMES:
                continue
            try:
                build_chart_pack(s, tf, db=None, write_redis=True, write_pg=True)
            except Exception as e:
                logger.warning("chart pack refresh %s %s: %s", s, tf, e)


def chart_pack_coin_list() -> list[str]:
    raw = os.getenv(
        "CHART_PACK_SLUGS",
        "bitcoin,ethereum,solana,binancecoin,cardano,dogecoin",
    )
    return [x.strip().lower() for x in raw.split(",") if x.strip()]
