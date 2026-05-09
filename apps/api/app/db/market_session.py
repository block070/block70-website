"""
Second SQLAlchemy engine for the Timescale/market OHLC warehouse (optional).

Set MARKET_DATA_DATABASE_URL (see .env.example). If unset, the main API still
starts; /api/v1/market-warehouse/* returns 503 when invoked.
"""

from __future__ import annotations

import os
from collections.abc import Generator

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

_market_engine = None
_MarketSessionLocal: sessionmaker | None = None


def _lazy_init() -> sessionmaker:
    global _market_engine, _MarketSessionLocal
    if _MarketSessionLocal is not None:
        return _MarketSessionLocal
    url = (os.getenv("MARKET_DATA_DATABASE_URL") or "").strip()
    if not url:
        raise RuntimeError(
            "MARKET_DATA_DATABASE_URL is not set; market warehouse routes are disabled.",
        )
    _market_engine = create_engine(url, future=True, pool_pre_ping=True)
    _MarketSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=_market_engine,
        expire_on_commit=False,
    )
    return _MarketSessionLocal


def get_market_db() -> Generator[Session, None, None]:
    try:
        SessionLocal = _lazy_init()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
