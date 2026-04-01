"""Build pipeline-normalized market rows from DB when CoinGecko hydration fails."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.coin import Coin
from app.models.market_data import MarketData

logger = logging.getLogger(__name__)


def normalized_market_row_from_db(db: Session, slug: str) -> dict[str, Any] | None:
    """
    Same field shape as normalize_market_coin() output so _score_candidates can consume it.
    Used when /coins/markets by id is empty or errors but the coin exists in our DB.
    """
    s = (slug or "").strip().lower()
    if not s:
        return None
    try:
        coin = db.query(Coin).filter(Coin.slug == s).first()
        if not coin:
            return None
        md = (
            db.query(MarketData)
            .filter(MarketData.coin_id == coin.id)
            .order_by(MarketData.timestamp.desc())
            .first()
        )
        price = None
        if md is not None and md.price is not None:
            try:
                price = float(md.price)
            except (TypeError, ValueError):
                price = None
        if price is None or price <= 0:
            try:
                price = float(coin.price) if coin.price is not None else None
            except (TypeError, ValueError):
                price = None
        if price is None or price <= 0:
            price = 0.01

        def _fmv(v: Any) -> float | None:
            if v is None:
                return None
            try:
                x = float(v)
                return x if x == x else None
            except (TypeError, ValueError):
                return None

        mcap = _fmv(md.market_cap) if md else None
        if mcap is None:
            mcap = _fmv(coin.market_cap)
        vol = _fmv(md.volume_24h) if md else None
        if vol is None:
            vol = _fmv(coin.volume_24h)
        pc24 = _fmv(md.price_change_24h) if md else None
        pc7 = _fmv(md.price_change_7d) if md else None

        return {
            "external_id": coin.slug,
            "name": coin.name,
            "symbol": (coin.symbol or "").strip().upper() or "?",
            "slug": coin.slug,
            "description": coin.description,
            "logo_url": coin.logo_url,
            "market_cap_rank": coin.market_cap_rank,
            "website": coin.website,
            "twitter": coin.twitter,
            "discord": coin.discord,
            "chain": coin.chain,
            "category": coin.category,
            "market_cap": mcap,
            "price": price,
            "volume_24h": vol,
            "circulating_supply": coin.circulating_supply,
            "total_supply": coin.total_supply,
            "price_change_1h": None,
            "price_change_24h": pc24,
            "price_change_7d": pc7,
        }
    except Exception as e:
        logger.debug("normalized_market_row_from_db %s: %s", s, e)
        return None


def minimal_row_for_major_slug(slug: str, focus_symbol_upper: str) -> dict[str, Any] | None:
    """
    Last-resort row when CG and DB are empty but slug came from our major map (e.g. cardano + ADA).
    Keeps scoring + coin_intel deterministic; real prices should arrive on next CG/DB sync.
    """
    from app.api.v1.market import SLUG_TO_SYMBOL

    su = (focus_symbol_upper or "").strip().upper()
    sl = (slug or "").strip().lower()
    if not su or not sl:
        return None
    if SLUG_TO_SYMBOL.get(sl) != su:
        return None
    return {
        "external_id": sl,
        "name": su,
        "symbol": su,
        "slug": sl,
        "description": None,
        "logo_url": None,
        "market_cap_rank": None,
        "website": None,
        "twitter": None,
        "discord": None,
        "chain": None,
        "category": None,
        "market_cap": None,
        "price": 0.01,
        "volume_24h": None,
        "circulating_supply": None,
        "total_supply": None,
        "price_change_1h": 0.0,
        "price_change_24h": 0.0,
        "price_change_7d": 0.0,
    }
