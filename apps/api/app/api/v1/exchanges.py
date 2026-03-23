"""
Exchanges API – CoinGecko-style exchange leaderboard with Redis cache.
GET /api/v1/exchanges – list top 100, sorted by trust_score_rank ASC
POST /api/v1/exchanges/{id}/click – track affiliate click
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Exchange, ExchangeClick

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/exchanges", tags=["exchanges"])

EXCHANGES_CACHE_KEY = "exchanges_list"
EXCHANGES_CACHE_TTL = 300  # 5 minutes
COINGECKO_EXCHANGES = "https://api.coingecko.com/api/v3/exchanges"
TOP_LIMIT = 100

_REDIS_CLIENT = None


def _get_redis():
    global _REDIS_CLIENT
    if _REDIS_CLIENT is not None and _REDIS_CLIENT is not False:
        return _REDIS_CLIENT
    try:
        import redis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _REDIS_CLIENT = redis.Redis.from_url(url, decode_responses=True)
        _REDIS_CLIENT.ping()
        return _REDIS_CLIENT
    except Exception as e:
        logger.debug("Redis unavailable: %s", e)
        _REDIS_CLIENT = False
        return None


def _cache_get() -> Optional[List[Dict[str, Any]]]:
    r = _get_redis()
    if not r:
        return None
    try:
        raw = r.get(EXCHANGES_CACHE_KEY)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.debug("Redis get failed: %s", e)
    return None


def _cache_set(data: List[Dict[str, Any]]) -> None:
    r = _get_redis()
    if not r:
        return
    try:
        r.setex(EXCHANGES_CACHE_KEY, EXCHANGES_CACHE_TTL, json.dumps(data, separators=(",", ":")))
    except Exception as e:
        logger.debug("Redis set failed: %s", e)


async def _get_btc_price_usd() -> float:
    import asyncio

    from app.services.connectors.price_resolver import get_btc_price_usd

    price = await asyncio.to_thread(get_btc_price_usd)
    if price and price > 0:
        return price
    return 100_000.0


async def _fetch_from_coingecko() -> List[Dict[str, Any]]:
    """Fetch exchanges from CoinGecko and normalize (async)."""
    btc_price = await _get_btc_price_usd()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(COINGECKO_EXCHANGES)
            resp.raise_for_status()
            raw_list = resp.json()
    except Exception as e:
        logger.warning("CoinGecko exchanges fetch failed: %s", e)
        return []

    if not isinstance(raw_list, list):
        return []

    AFFILIATE_MAP = {
        "binance": "https://binance.com/en/activity/referral-entry/CPA",
        "gdax": "https://coinbase.com/join",
        "okex": "https://www.okx.com/join",
        "kraken": "https://www.kraken.com",
        "bybit_spot": "https://www.bybit.com",
        "bitget": "https://www.bitget.com",
        "gate": "https://www.gate.io",
        "crypto_com": "https://crypto.com/exchange",
        "kucoin": "https://www.kucoin.com",
        "huobi": "https://www.huobi.com",
        "mxc": "https://www.mexc.com",
    }

    out = []
    for r in raw_list:
        try:
            ex_id = str(r.get("id", "")).strip()
            name = str(r.get("name", "Unknown")).strip()
            if not ex_id or not name:
                continue
            vol_btc = float(r.get("trade_volume_24h_btc") or 0)
            vol_usd = vol_btc * btc_price
            trust_rank = int(r.get("trust_score_rank") or 999)
            trust_score = int(r.get("trust_score") or 0)
            url = str(r.get("url") or "")
            image = str(r.get("image") or "")
            year = r.get("year_established")
            year_int = int(year) if year is not None and str(year).replace(".", "").isdigit() else None
            country = str(r.get("country") or "").strip() or None
            slug = name.lower().replace(" ", "-").replace("_", "-")[:128]
            affiliate = AFFILIATE_MAP.get(ex_id) or AFFILIATE_MAP.get(slug)
            final_url = affiliate if affiliate else url
            # Future fields: mock for now, structure for real integrations
            liquidity_score = round(0.5 + (trust_score / 20.0), 2)  # 0.5-1.0 mock
            user_count_estimate = int(vol_usd / 5000) if vol_usd > 0 else 0  # rough mock
            supported_coins = max(50, min(500, trust_rank * 10))  # mock
            out.append({
                "id": ex_id,
                "name": name,
                "image": image or "",
                "trust_score_rank": trust_rank,
                "trust_score": trust_score,
                "trade_volume_24h_btc": round(vol_btc, 4),
                "trade_volume_24h_usd": round(vol_usd, 2),
                "url": url,
                "final_url": final_url,
                "year_established": year_int,
                "country": country,
                "slug": slug,
                "liquidity_score": liquidity_score,
                "user_count_estimate": user_count_estimate,
                "supported_coins": supported_coins,
            })
        except (TypeError, ValueError):
            continue

    out.sort(key=lambda x: (x["trust_score_rank"], -x["trade_volume_24h_usd"]))
    return out[:TOP_LIMIT]


def _from_db(db: Session) -> List[Dict[str, Any]]:
    """Read from DB (used when cache miss and CoinGecko fails)."""
    rows = db.query(Exchange).order_by(Exchange.trust_score_rank.asc()).limit(TOP_LIMIT).all()
    AFFILIATE_MAP = {
        "binance": "https://binance.com/en/activity/referral-entry/CPA",
        "gdax": "https://coinbase.com/join",
        "okex": "https://www.okx.com/join",
    }
    out = []
    for r in rows:
        affiliate = AFFILIATE_MAP.get(r.id) or r.affiliate_url
        final_url = affiliate if affiliate else r.url
        out.append({
            "id": r.id,
            "name": r.name,
            "image": r.image or "",
            "trust_score_rank": r.trust_score_rank,
            "trust_score": r.trust_score,
            "trade_volume_24h_btc": 0,
            "trade_volume_24h_usd": r.volume_24h_usd,
            "url": r.url,
            "final_url": final_url,
            "year_established": r.year_established,
            "country": r.country,
            "slug": r.slug,
            "liquidity_score": round(0.5 + (r.trust_score / 20.0), 2),
            "user_count_estimate": int(r.volume_24h_usd / 5000) if r.volume_24h_usd else 0,
            "supported_coins": max(50, min(500, r.trust_score_rank * 10)),
        })
    return out


@router.get("")
async def get_exchanges(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Return top 100 exchanges by trust_score_rank ASC.
    Cached in Redis for 5 minutes. CoinGecko data with BTC→USD conversion.
    """
    start = time.perf_counter()
    cached = _cache_get()
    if cached is not None:
        elapsed = (time.perf_counter() - start) * 1000
        if elapsed > 50:
            logger.info("Exchanges API cached response: %.0fms", elapsed)
        return cached

    data = await _fetch_from_coingecko()
    if not data:
        data = _from_db(db)

    if data:
        _cache_set(data)
    elapsed = (time.perf_counter() - start) * 1000
    logger.info("Exchanges API response: %.0fms (cached=False)", elapsed)
    return data


@router.get("/{exchange_id}")
async def get_exchange_by_id(
    exchange_id: str,
    db: Session = Depends(get_db),
) -> Optional[Dict[str, Any]]:
    """Get single exchange by id or slug."""
    cached = _cache_get()
    if cached:
        for ex in cached:
            if ex.get("id") == exchange_id or ex.get("slug") == exchange_id:
                return ex
    ex = db.query(Exchange).filter(
        (Exchange.id == exchange_id) | (Exchange.slug == exchange_id)
    ).first()
    if not ex:
        return None
    AFFILIATE_MAP = {"binance": "https://binance.com/en/activity/referral-entry/CPA", "gdax": "https://coinbase.com/join"}
    affiliate = AFFILIATE_MAP.get(ex.id) or ex.affiliate_url
    return {
        "id": ex.id,
        "name": ex.name,
        "slug": ex.slug,
        "image": ex.image or "",
        "trust_score_rank": ex.trust_score_rank,
        "trust_score": ex.trust_score,
        "trade_volume_24h_usd": ex.volume_24h_usd,
        "url": ex.url,
        "final_url": affiliate or ex.url,
        "year_established": ex.year_established,
        "country": ex.country,
    }


@router.post("/{exchange_id}/click")
def track_exchange_click(
    exchange_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Track affiliate click. Non-blocking."""
    try:
        db.add(ExchangeClick(exchange_id=exchange_id))
        db.commit()
    except Exception as e:
        logger.warning("Exchange click tracking failed: %s", e)
        db.rollback()
    return {"status": "ok", "exchange_id": exchange_id}
