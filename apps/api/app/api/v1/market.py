from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.connectors.coingecko_connector import fetch_trending_coins


router = APIRouter(prefix="/api/v1/market", tags=["market"])


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

