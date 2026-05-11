"""Shared Timescale `bars_1m` insert helpers for market ingest scripts."""

from __future__ import annotations

import os
from datetime import datetime
from urllib.parse import urlparse, urlunparse

import psycopg2


def connect_market_db():
    db_url = os.getenv("MARKET_DATA_DATABASE_URL", "").strip()
    if not db_url:
        raise RuntimeError("MARKET_DATA_DATABASE_URL is not set")
    parsed = urlparse(db_url.replace("postgresql+psycopg2://", "postgresql://"))
    return psycopg2.connect(urlunparse(parsed))


def load_warehouse_symbols(conn, *, asset_class: str, exchange: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT symbol
            FROM bars_1m
            WHERE asset_class = %s AND exchange = %s
            ORDER BY symbol
            """,
            (asset_class, exchange),
        )
        return [row[0] for row in cur.fetchall() if row[0]]


def insert_bars(
    conn,
    symbol: str,
    bars: list[dict],
    *,
    asset_class: str,
    exchange: str,
    source: str,
    use_on_conflict: bool,
) -> int:
    if not bars:
        return 0
    if use_on_conflict:
        sql = """
            INSERT INTO bars_1m (ts, asset_class, exchange, symbol, open, high, low, close, volume, source)
            VALUES (%(ts)s, %(asset_class)s, %(exchange)s, %(symbol)s, %(open)s, %(high)s, %(low)s, %(close)s, %(volume)s, %(source)s)
            ON CONFLICT (ts, asset_class, exchange, symbol) DO NOTHING
        """
    else:
        sql = """
            INSERT INTO bars_1m (ts, asset_class, exchange, symbol, open, high, low, close, volume, source)
            SELECT %(ts)s, %(asset_class)s, %(exchange)s, %(symbol)s, %(open)s, %(high)s, %(low)s, %(close)s, %(volume)s, %(source)s
            WHERE NOT EXISTS (
                SELECT 1 FROM bars_1m b
                WHERE b.asset_class = %(asset_class)s
                  AND b.exchange = %(exchange)s
                  AND b.symbol = %(symbol)s
                  AND b.ts = %(ts)s
            )
        """
    inserted = 0
    with conn.cursor() as cur:
        for b in bars:
            row = {
                "ts": b["ts"],
                "asset_class": asset_class,
                "exchange": exchange,
                "symbol": symbol,
                "open": float(b["open"]),
                "high": float(b["high"]),
                "low": float(b["low"]),
                "close": float(b["close"]),
                "volume": float(b.get("volume") or 0),
                "source": source,
            }
            cur.execute(sql, row)
            inserted += cur.rowcount
    conn.commit()
    return inserted
