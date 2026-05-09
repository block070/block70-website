"""
OHLCV warehouse API (TimescaleDB). CoinGecko routes stay in market.py.

Do not add warehouse-only endpoints to market.py; it exports SLUG_TO_SYMBOL and is
imported by AI intelligence services at app load.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.market_session import get_market_db

router = APIRouter(prefix="/api/v1/market-warehouse", tags=["market-warehouse"])

TABLE_MAP: dict[str, tuple[str, str]] = {
    "1m": ("bars_1m", "ts"),
    "5m": ("bars_5m", "bucket"),
    "15m": ("bars_15m", "bucket"),
    "1h": ("bars_1h", "bucket"),
    "1d": ("bars_1d", "bucket"),
}


@router.get("/health")
def market_warehouse_health(db: Session = Depends(get_market_db)):
    try:
        row = db.execute(text("SELECT now() AS now_utc")).mappings().first()
        assert row is not None
        return {"ok": True, "now_utc": row["now_utc"].isoformat()}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=503, detail=f"market warehouse db: {e}") from e


@router.get("/bars")
def get_bars(
    asset_class: Literal["crypto", "equity"] = Query(...),
    exchange: str = Query(..., min_length=1, max_length=32),
    symbol: str = Query(..., min_length=1, max_length=64),
    timeframe: Literal["1m", "5m", "15m", "1h", "1d"] = "1m",
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_market_db),
):
    try:
        table, ts_col = TABLE_MAP[timeframe]
        where_clauses = [
            "asset_class = :asset_class",
            "exchange = :exchange",
            "symbol = :symbol",
        ]
        params: dict[str, object] = {
            "asset_class": asset_class,
            "exchange": exchange,
            "symbol": symbol,
            "limit": limit,
        }
        if start is not None:
            where_clauses.append(f"{ts_col} >= :start")
            params["start"] = start
        if end is not None:
            where_clauses.append(f"{ts_col} <= :end")
            params["end"] = end

        sql = f"""
            SELECT {ts_col} AS ts, open, high, low, close, volume
            FROM {table}
            WHERE {' AND '.join(where_clauses)}
            ORDER BY ts ASC
            LIMIT :limit
        """
        rows = db.execute(text(sql), params).mappings().all()
    except SQLAlchemyError as e:
        raise HTTPException(status_code=503, detail=f"query failed: {e}") from e

    return {
        "asset_class": asset_class,
        "exchange": exchange,
        "symbol": symbol,
        "timeframe": timeframe,
        "count": len(rows),
        "items": [
            {
                "ts": r["ts"].isoformat() if r["ts"] else None,
                "open": float(r["open"]) if r["open"] is not None else None,
                "high": float(r["high"]) if r["high"] is not None else None,
                "low": float(r["low"]) if r["low"] is not None else None,
                "close": float(r["close"]) if r["close"] is not None else None,
                "volume": float(r["volume"]) if r["volume"] is not None else None,
            }
            for r in rows
        ],
    }
