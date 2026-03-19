from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Coin, MarketData
from app.services.connectors.coingecko_connector import (
    fetch_all_coins,
    fetch_trending_coins,
)


router = APIRouter(prefix="/api/v1/market", tags=["market"])


def _serialize_market_item(item: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": item.get("name"),
        "symbol": item.get("symbol"),
        "price": item.get("price"),
        "change_24h": item.get("price_change_24h"),
        "change_7d": item.get("price_change_7d"),
        "market_cap": item.get("market_cap"),
        "volume": item.get("volume_24h"),
        "slug": item.get("slug"),
        "logo_url": item.get("logo_url"),
    }


def _load_market_fallback_from_db(db: Session, *, limit: int) -> List[Dict[str, Any]]:
    """
    Return last-known-good market snapshot from DB when CoinGecko is unavailable.
    """
    coins = (
        db.query(Coin)
        .order_by(Coin.market_cap.desc().nullslast())
        .limit(limit)
        .all()
    )

    rows: List[Dict[str, Any]] = []
    for coin in coins:
        latest_md = (
            db.query(MarketData)
            .filter(MarketData.coin_id == coin.id)
            .order_by(MarketData.timestamp.desc())
            .first()
        )
        rows.append(
            {
                "name": coin.name,
                "symbol": coin.symbol,
                "price": latest_md.price if latest_md and latest_md.price is not None else coin.price,
                "change_24h": latest_md.price_change_24h if latest_md else None,
                "change_7d": latest_md.price_change_7d if latest_md else None,
                "market_cap": latest_md.market_cap if latest_md and latest_md.market_cap is not None else coin.market_cap,
                "volume": latest_md.volume_24h if latest_md and latest_md.volume_24h is not None else coin.volume_24h,
                "slug": coin.slug,
                "logo_url": coin.logo_url,
            }
        )
    return rows


@router.get("/coins", response_model=List[Dict[str, Any]])
def get_market_coins(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    page: int = Query(1, ge=1, le=10),
) -> List[Dict[str, Any]]:
    """
    Return live market coins from CoinGecko /coins/markets.

    Request params used:
    - vs_currency=usd
    - order=market_cap_desc
    - per_page=<limit>
    - page=<page>
    - price_change_percentage=24h,7d
    """
    try:
        items = fetch_all_coins(vs_currency="usd", per_page=limit, page=page)
        return [_serialize_market_item(item) for item in items]
    except Exception as exc:  # pragma: no cover - network errors
        fallback_rows = _load_market_fallback_from_db(db, limit=limit)
        if fallback_rows:
            return fallback_rows
        raise HTTPException(status_code=502, detail="Failed to load CoinGecko market data and no fallback snapshot available") from exc


@router.get("/trending", response_model=List[Dict[str, Any]])
def get_trending_market_coins(
    db: Session = Depends(get_db),  # noqa: ARG001 (reserved for future DB-backed enrichment)
    limit: int = Query(20, ge=1, le=100),
) -> List[Dict[str, Any]]:
    """
    Return trending coins from CoinGecko's /search/trending endpoint.

    This is a thin proxy over CoinGecko with a stable, frontend-friendly shape:

    - name
    - symbol
    - rank
    - price (CoinGecko price_btc; BTC-denominated)
    - image
    - coingecko_id
    - score
    """
    try:
        items = fetch_trending_coins()
    except Exception as exc:  # pragma: no cover - network errors
        raise HTTPException(status_code=502, detail="Failed to load CoinGecko trending data") from exc

    return items[:limit]

