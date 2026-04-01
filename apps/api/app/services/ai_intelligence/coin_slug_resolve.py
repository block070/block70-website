"""Resolve display tickers to CoinGecko coin ids for off-universe intel hydration."""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.api.v1.market import SLUG_TO_SYMBOL
from app.models.coin import Coin
from app.services.connectors.coingecko_connector import search_coins

logger = logging.getLogger(__name__)

_SYMBOL_TO_SLUG_MAJORS: dict[str, str] | None = None


def _symbol_to_slug_majors() -> dict[str, str]:
    global _SYMBOL_TO_SLUG_MAJORS
    if _SYMBOL_TO_SLUG_MAJORS is None:
        inv: dict[str, str] = {}
        for slug, sym in SLUG_TO_SYMBOL.items():
            s = str(sym).strip().upper()
            if s:
                inv[s] = slug
        _SYMBOL_TO_SLUG_MAJORS = inv
    return _SYMBOL_TO_SLUG_MAJORS


def resolve_coingecko_slug_for_ticker(db: Session | None, ticker: str) -> Optional[str]:
    """
    CoinGecko `id` (slug) for a user ticker, e.g. ADA -> cardano.
    Order: DB symbol match, inverse SLUG_TO_SYMBOL map, CoinGecko search.
    """
    t = (ticker or "").strip().upper()
    if not t or len(t) > 10:
        return None
    if db:
        try:
            row = db.query(Coin).filter(Coin.symbol == t).first()
            if row and row.slug:
                return str(row.slug).strip().lower()
        except Exception as e:
            logger.debug("resolve slug db lookup %s: %s", t, e)
    slug_hit = _symbol_to_slug_majors().get(t)
    if slug_hit:
        return slug_hit
    try:
        hits = search_coins(t) or []
    except Exception as e:
        logger.debug("resolve slug search_coins %s: %s", t, e)
        return None
    if not hits:
        return None
    t_low = t.lower()
    for h in hits:
        if not isinstance(h, dict):
            continue
        sym = str(h.get("symbol") or "").strip().lower()
        if sym == t_low:
            cid = str(h.get("id") or "").strip().lower()
            return cid or None
    first = hits[0]
    if isinstance(first, dict):
        cid = str(first.get("id") or "").strip().lower()
        return cid or None
    return None
