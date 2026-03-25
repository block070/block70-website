"""Chart OHLCV API – GET /api/v1/charts/{symbol}, Block70 pack GET /api/v1/chart"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.charts.chart_pack_service import PACK_TIMEFRAMES, get_chart_pack_cached
from app.services.charts.chart_service import get_ohlcv

router = APIRouter(prefix="/api/v1/charts", tags=["charts"])
chart_pack_router = APIRouter(prefix="/api/v1/chart", tags=["charts"])


@router.get("/{symbol}")
def get_chart_data(
    symbol: str,
    timeframe: str = Query("1h", description="1m, 5m, 15m, 1h, 4h, 1d, 1w"),
    limit: int = Query(1000, ge=1, le=1000, description="Max candles to return"),
) -> dict:
    """
    Fetch OHLCV chart data. Priority: Binance.com → Coinbase → Binance.US → CoinGecko.
    symbol: base ticker (BTC, ETH) or slug (bitcoin, ethereum).
    """
    try:
        data = get_ohlcv(symbol, timeframe, limit)
        return {"ohlcv": data}
    except Exception:
        return {"ohlcv": []}


@chart_pack_router.get("")
def get_block70_chart_pack(
    coin: str = Query(..., description="Coin slug (bitcoin) or ticker (BTC)"),
    timeframe: str = Query("1h", description="1m, 5m, 1h, 4h, 1d"),
    db: Session = Depends(get_db),
) -> dict:
    """
    Full chart payload: OHLCV, volume series, RSI/MACD/MAs, Block70 score + signal + markers.
    Cached in Redis (~55s TTL); historical snapshots in PostgreSQL (chart_pack_snapshots).
    """
    tf = (timeframe or "1h").lower().strip()
    if tf not in PACK_TIMEFRAMES:
        raise HTTPException(
            status_code=400,
            detail=f"timeframe must be one of {sorted(PACK_TIMEFRAMES)}",
        )
    try:
        return get_chart_pack_cached(coin, tf, db=db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
