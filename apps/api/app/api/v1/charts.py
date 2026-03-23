"""Chart OHLCV API – GET /api/v1/charts/{symbol}"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.charts.chart_service import get_ohlcv

router = APIRouter(prefix="/api/v1/charts", tags=["charts"])


@router.get("/{symbol}")
def get_chart_data(
    symbol: str,
    timeframe: str = Query("1h", description="1m, 5m, 15m, 1h, 4h, 1d, 1w"),
    limit: int = Query(200, ge=1, le=500, description="Max candles to return"),
) -> dict:
    """
    Fetch OHLCV chart data. Priority: Coinbase → Binance.US → CoinGecko.
    symbol: base ticker (BTC, ETH) or slug (bitcoin, ethereum).
    """
    try:
        data = get_ohlcv(symbol, timeframe, limit)
        return {"ohlcv": data}
    except Exception:
        return {"ohlcv": []}
