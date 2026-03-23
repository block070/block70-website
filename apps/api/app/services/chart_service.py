"""
Chart data service: Storage (DB) → Binance.US → CoinGecko.
Persists on API success so we rely less on external APIs.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql import func

from app.db import SessionLocal
from app.models import ChartSnapshot
from app.services.connectors.binance_us_connector import fetch_klines_chart, slug_to_binance_symbol
from app.services.connectors.chart_cache import chart_cache_get, chart_cache_set, get_chart_ttl
from app.services.connectors.coingecko_connector import (
    COINGECKO_API_BASE,
    fetch_market_chart as _coingecko_fetch,
)

logger = logging.getLogger(__name__)


def _coingecko_market_chart_raw(coin_id: str, days_param: str, vs_currency: str) -> dict[str, Any] | None:
    """Call CoinGecko directly; returns None on 429 or other errors."""
    import requests

    try:
        url = f"{COINGECKO_API_BASE}/coins/{coin_id}/market_chart"
        resp = requests.get(
            url, params={"vs_currency": vs_currency, "days": days_param}, timeout=10
        )
        resp.raise_for_status()
        return resp.json()
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            logger.warning("CoinGecko 429 for chart %s/%s", coin_id, days_param)
            return None
        raise
    except Exception as e:
        logger.debug("CoinGecko chart error: %s", e)
        return None


def chart_snapshot_get(coin_slug: str, days_param: str, vs_currency: str = "usd") -> dict[str, Any] | None:
    """Load chart from ChartSnapshot table. Returns {prices, market_caps, total_volumes} or None."""
    db = SessionLocal()
    try:
        row = db.execute(
            select(ChartSnapshot).where(
                ChartSnapshot.coin_slug == coin_slug,
                ChartSnapshot.days_param == days_param,
                ChartSnapshot.vs_currency == vs_currency,
            )
        ).scalar_one_or_none()
        if not row or not row.prices_json:
            return None
        data = json.loads(row.prices_json)
        if isinstance(data, list):
            return {"prices": data, "market_caps": [], "total_volumes": []}
        return {
            "prices": data.get("prices", data) if isinstance(data, dict) else data,
            "market_caps": data.get("market_caps", []) if isinstance(data, dict) else [],
            "total_volumes": data.get("total_volumes", []) if isinstance(data, dict) else [],
        }
    except Exception as e:
        logger.debug("ChartSnapshot get failed: %s", e)
        return None
    finally:
        db.close()


def chart_snapshot_upsert(coin_slug: str, days_param: str, data: dict[str, Any], source: str, vs_currency: str = "usd") -> None:
    """Persist chart to DB. Upserts on (coin_slug, days_param, vs_currency)."""
    prices = data.get("prices") or []
    if not prices:
        return
    payload = json.dumps(prices)
    db = SessionLocal()
    try:
        stmt = insert(ChartSnapshot).values(
            coin_slug=coin_slug,
            days_param=days_param,
            vs_currency=vs_currency,
            prices_json=payload,
            source=source,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_chart_slug_days",
            set_={"prices_json": payload, "source": source, "updated_at": func.now()},
        )
        db.execute(stmt)
        db.commit()
        logger.info("ChartSnapshot saved %s/%s from %s", coin_slug, days_param, source)
    except SQLAlchemyError as e:
        db.rollback()
        logger.warning("ChartSnapshot upsert failed: %s", e)
    finally:
        db.close()


def fetch_market_chart(
    coin_id: str,
    days: int | str = 7,
    vs_currency: str = "usd",
    symbol_override: str | None = None,
) -> dict[str, Any]:
    """
    Fetch chart: 1) cache, 2) DB storage, 3) Binance.US, 4) CoinGecko.
    Persists to DB on API success.
    """
    days_param = "max" if days == "max" or (isinstance(days, int) and days > 365) else str(days)
    days_int = 365 if days_param == "max" else int(days_param)
    cache_key = f"{coin_id}:{days_param}:{vs_currency}"
    ttl = get_chart_ttl(days_param)

    # 1) Redis/memory cache
    cached = chart_cache_get(cache_key)
    if cached is not None:
        return cached

    # 2) DB ChartSnapshot
    db_data = chart_snapshot_get(coin_id, days_param, vs_currency)
    if db_data and (db_data.get("prices") or []):
        chart_cache_set(cache_key, db_data, ttl)
        return db_data

    # 3) Binance.US (when symbol available)
    bn_symbol = symbol_override or slug_to_binance_symbol(coin_id)
    if bn_symbol:
        prices = fetch_klines_chart(bn_symbol, days=days_int)
        if prices:
            data = {"prices": prices, "market_caps": [], "total_volumes": []}
            chart_snapshot_upsert(coin_id, days_param, data, "binance_us", vs_currency)
            chart_cache_set(cache_key, data, ttl)
            return data

    # 4) CoinGecko (tertiary)
    cg_data = _coingecko_market_chart_raw(coin_id, days_param, vs_currency)
    if cg_data:
        chart_snapshot_upsert(coin_id, days_param, cg_data, "coingecko", vs_currency)
        chart_cache_set(cache_key, cg_data, ttl)
        return cg_data

    # Fallback: try original fetch_market_chart (uses stale cache on 429)
    try:
        data = _coingecko_fetch(coin_id, days=days_param, vs_currency=vs_currency, symbol_override=symbol_override)
        if data and (data.get("prices") or []):
            chart_snapshot_upsert(coin_id, days_param, data, "coingecko", vs_currency)
            chart_cache_set(cache_key, data, ttl)
            return data
    except Exception as e:
        logger.debug("CoinGecko fallback failed: %s", e)

    return {"prices": [], "market_caps": [], "total_volumes": []}
