"""
Exchanges pipeline – sync from CoinGecko, store in Postgres.
Runs as a background job every 10 minutes.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app.models import Exchange

logger = logging.getLogger(__name__)

COINGECKO_EXCHANGES = "https://api.coingecko.com/api/v3/exchanges"
COINGECKO_SIMPLE_PRICE = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"

# Affiliate mapping: exchange id/slug -> affiliate URL (override)
# Add real codes when available; structure supports multiple links later
AFFILIATE_MAP: Dict[str, str] = {
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


def _slug_from_name(name: str) -> str:
    """Generate slug: lowercase(name).replace(' ', '-')."""
    return name.lower().replace(" ", "-").replace("_", "-")[:128]


def _get_btc_price_usd() -> float:
    """Fetch BTC price in USD from CoinGecko simple price."""
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(COINGECKO_SIMPLE_PRICE)
            resp.raise_for_status()
            data = resp.json()
            return float(data.get("bitcoin", {}).get("usd", 0) or 0)
    except Exception as e:
        logger.warning("BTC price fetch failed, using 100k: %s", e)
        return 100_000.0


def _fetch_coingecko_exchanges() -> List[Dict[str, Any]]:
    """Fetch exchange list from CoinGecko."""
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(COINGECKO_EXCHANGES)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error("CoinGecko exchanges fetch failed: %s", e)
        return []


def _normalize_exchange(raw: Dict[str, Any], btc_price_usd: float) -> Optional[Dict[str, Any]]:
    """Normalize CoinGecko exchange to our schema."""
    try:
        ex_id = str(raw.get("id", "")).strip()
        name = str(raw.get("name", "Unknown")).strip()
        if not ex_id or not name:
            return None

        vol_btc = float(raw.get("trade_volume_24h_btc") or 0)
        vol_usd = vol_btc * btc_price_usd
        trust_rank = int(raw.get("trust_score_rank") or 999)
        trust_score = int(raw.get("trust_score") or 0)
        url = str(raw.get("url") or "")
        image = str(raw.get("image") or "")
        year = raw.get("year_established")
        year_int = int(year) if year is not None and str(year).isdigit() else None
        country = str(raw.get("country") or "").strip() or None

        slug = _slug_from_name(name)
        affiliate = AFFILIATE_MAP.get(ex_id) or AFFILIATE_MAP.get(slug)

        return {
            "id": ex_id,
            "name": name,
            "slug": slug,
            "trust_score_rank": trust_rank,
            "trust_score": trust_score,
            "volume_24h_usd": round(vol_usd, 2),
            "url": url,
            "affiliate_url": affiliate,
            "image": image or None,
            "year_established": year_int,
            "country": country,
        }
    except (TypeError, ValueError) as e:
        logger.debug("Skip exchange %s: %s", raw.get("id"), e)
        return None


def run_exchanges_sync(db: Session, limit: int = 100) -> Dict[str, Any]:
    """
    Fetch CoinGecko exchanges, convert volume to USD, upsert to DB.
    Detects new exchanges, updates volume/rank/trust_score.
    Logs when new exchange added or rank changes significantly.
    """
    btc_price = _get_btc_price_usd()
    raw_list = _fetch_coingecko_exchanges()
    if not raw_list:
        return {"status": "error", "message": "No data from CoinGecko", "synced": 0}

    # Sort by trust_score_rank ASC, take top limit
    raw_list.sort(key=lambda x: (int(x.get("trust_score_rank") or 999), -(float(x.get("trade_volume_24h_btc") or 0))))
    raw_list = raw_list[:limit]

    existing = {row.id: row for row in db.query(Exchange).all()}
    new_count = 0
    updated_count = 0
    rank_changes = []

    for raw in raw_list:
        norm = _normalize_exchange(raw, btc_price)
        if not norm:
            continue

        ex = existing.get(norm["id"])
        if ex is None:
            db.add(
                Exchange(
                    id=norm["id"],
                    name=norm["name"],
                    slug=norm["slug"],
                    trust_score_rank=norm["trust_score_rank"],
                    trust_score=norm["trust_score"],
                    volume_24h_usd=norm["volume_24h_usd"],
                    url=norm["url"],
                    affiliate_url=norm.get("affiliate_url"),
                    image=norm.get("image"),
                    year_established=norm.get("year_established"),
                    country=norm.get("country"),
                )
            )
            new_count += 1
            logger.info("New exchange added: %s (%s)", norm["name"], norm["id"])
        else:
            old_rank = ex.trust_score_rank
            if abs(old_rank - norm["trust_score_rank"]) >= 3:
                rank_changes.append((norm["name"], old_rank, norm["trust_score_rank"]))
            ex.trust_score_rank = norm["trust_score_rank"]
            ex.trust_score = norm["trust_score"]
            ex.volume_24h_usd = norm["volume_24h_usd"]
            ex.url = norm["url"]
            if norm.get("affiliate_url") is not None:
                ex.affiliate_url = norm["affiliate_url"]
            ex.image = norm.get("image") or ex.image
            ex.year_established = norm.get("year_established")
            ex.country = norm.get("country")
            updated_count += 1

    for name, old_r, new_r in rank_changes:
        logger.info("Exchange rank changed: %s #%d -> #%d", name, old_r, new_r)

    db.commit()
    return {
        "status": "ok",
        "synced": new_count + updated_count,
        "new": new_count,
        "updated": updated_count,
    }
