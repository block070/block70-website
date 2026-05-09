#!/usr/bin/env python3
"""
Pull equity OHLC bars from Alpaca Market Data API and upsert into Timescale `bars_1m`.

Prerequisites:
  - APCA_API_KEY_ID + APCA_API_SECRET_KEY (same keys as Alpaca trading API)
  - MARKET_DATA_DATABASE_URL (warehouse Timescale; psycopg2 URL)
  - Table `bars_1m` with columns at least:
      ts timestamptz, asset_class text, exchange text, symbol text,
      open, high, low, close, volume double precision
  - A unique constraint on (ts, asset_class, exchange, symbol) for ON CONFLICT (see sql snippet in docs)

Usage:
  set MARKET_DATA_DATABASE_URL=postgresql://...
  set APCA_API_KEY_ID=...
  set APCA_API_SECRET_KEY=...
  python3 scripts/market/alpaca_bars_ingest.py --symbols-file data/market/sp500/constituents.csv \\
      --start 2025-05-01 --end 2025-05-09 --sleep 0.2

Feed: set ALPACA_DATA_FEED=sip or iex (default iex). SIP requires the appropriate Alpaca data subscription.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse, urlunparse

import psycopg2
import requests

ALPACA_DATA_BASE = "https://data.alpaca.markets"


def _repo_root() -> Path:
    p = Path(__file__).resolve()
    for parent in [p.parent] + list(p.parents):
        if (parent / "AGENTS.md").is_file():
            return parent
    return Path(__file__).resolve().parents[2]


def load_symbols_from_csv(path: Path) -> list[str]:
    symbols: list[str] = []
    with path.open(newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            s = (row.get("symbol") or "").strip().upper()
            if s:
                symbols.append(s)
    return sorted(set(symbols))


def _iso_z(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_bars_page(
    session: requests.Session,
    symbol: str,
    *,
    timeframe: str,
    start: datetime,
    end: datetime,
    feed: str,
    limit: int,
    page_token: str | None,
) -> dict[str, Any]:
    # Path segment must encode symbols like BRK.B
    enc = quote(symbol, safe=".")
    params: dict[str, Any] = {
        "timeframe": timeframe,
        "start": _iso_z(start),
        "end": _iso_z(end),
        "limit": limit,
        "feed": feed,
        "adjustment": "raw",
    }
    if page_token:
        params["page_token"] = page_token
    url = f"{ALPACA_DATA_BASE}/v2/stocks/{enc}/bars"
    r = session.get(url, params=params, timeout=120)
    if r.status_code == 403:
        raise RuntimeError(
            f"Alpaca returned 403 for {symbol}. Check data subscription and ALPACA_DATA_FEED "
            f"(sip vs iex). Body: {r.text[:500]}"
        )
    r.raise_for_status()
    return r.json()


def _bar_ts(bar: dict[str, Any]) -> datetime:
    t = bar.get("t")
    if t is None:
        raise ValueError("bar missing t")
    if isinstance(t, (int, float)):
        # nanoseconds or ms from Alpaca — newer API uses ns string
        ts = float(t)
        if ts > 1e15:  # nanoseconds
            ts /= 1e9
        elif ts > 1e12:  # microseconds
            ts /= 1e6
        elif ts > 1e9:  # ms
            ts /= 1000.0
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(t, str):
        # RFC3339
        return datetime.fromisoformat(t.replace("Z", "+00:00"))
    raise ValueError(f"unknown bar timestamp type: {type(t)} {t!r}")


def upsert_bars(
    conn,
    symbol: str,
    bars: list[dict[str, Any]],
    *,
    asset_class: str,
    exchange: str,
) -> int:
    if not bars:
        return 0
    sql = """
        INSERT INTO bars_1m (ts, asset_class, exchange, symbol, open, high, low, close, volume)
        VALUES (%(ts)s, %(asset_class)s, %(exchange)s, %(symbol)s, %(open)s, %(high)s, %(low)s, %(close)s, %(volume)s)
        ON CONFLICT (ts, asset_class, exchange, symbol) DO NOTHING
    """
    inserted = 0
    with conn.cursor() as cur:
        for b in bars:
            row = {
                "ts": _bar_ts(b),
                "asset_class": asset_class,
                "exchange": exchange,
                "symbol": symbol,
                "open": float(b["o"]),
                "high": float(b["h"]),
                "low": float(b["l"]),
                "close": float(b["c"]),
                "volume": float(b.get("v") or 0),
            }
            cur.execute(sql, row)
            inserted += cur.rowcount
    conn.commit()
    return inserted


def main() -> int:
    p = argparse.ArgumentParser(description="Ingest Alpaca stock bars into bars_1m.")
    p.add_argument(
        "--symbols-file",
        type=Path,
        default=_repo_root() / "data" / "market" / "sp500" / "constituents.csv",
    )
    p.add_argument("--start", required=True, help="UTC date YYYY-MM-DD (inclusive)")
    p.add_argument("--end", required=True, help="UTC date YYYY-MM-DD (exclusive end boundary)")
    p.add_argument("--timeframe", default="1Min", help="Alpaca timeframe e.g. 1Min, 5Min, 1Hour")
    p.add_argument("--feed", default=os.getenv("ALPACA_DATA_FEED", "iex"))
    p.add_argument("--sleep", type=float, default=0.25, help="Seconds between symbols")
    p.add_argument("--asset-class", default="equity")
    p.add_argument("--exchange", default="ALPACA")
    p.add_argument("--limit", type=int, default=10000)
    p.add_argument("--max-symbols", type=int, default=0, help="0 = all symbols in file")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    key = os.getenv("APCA_API_KEY_ID") or os.getenv("ALPACA_API_KEY_ID")
    secret = os.getenv("APCA_API_SECRET_KEY") or os.getenv("ALPACA_API_SECRET_KEY")
    if not key or not secret:
        print("Set APCA_API_KEY_ID and APCA_API_SECRET_KEY (or ALPACA_* aliases).", file=sys.stderr)
        return 1

    db_url = os.getenv("MARKET_DATA_DATABASE_URL", "").strip()
    if not db_url and not args.dry_run:
        print("Set MARKET_DATA_DATABASE_URL for Timescale.", file=sys.stderr)
        return 1

    symbols = load_symbols_from_csv(args.symbols_file)
    if args.max_symbols > 0:
        symbols = symbols[: args.max_symbols]

    start_dt = datetime.combine(date.fromisoformat(args.start), datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(date.fromisoformat(args.end), datetime.min.time(), tzinfo=timezone.utc)

    session = requests.Session()
    session.headers.update(
        {
            "APCA-API-KEY-ID": key,
            "APCA-API-SECRET-KEY": secret,
        }
    )

    conn = None
    if not args.dry_run:
        # SQLAlchemy URLs may use postgresql+psycopg2 — normalize for psycopg2.connect
        parsed = urlparse(db_url.replace("postgresql+psycopg2://", "postgresql://"))
        conn_dsn = urlunparse(parsed)
        conn = psycopg2.connect(conn_dsn)

    total_rows = 0
    try:
        for i, sym in enumerate(symbols):
            token: str | None = None
            sym_bars: list[dict[str, Any]] = []
            while True:
                payload = fetch_bars_page(
                    session,
                    sym,
                    timeframe=args.timeframe,
                    start=start_dt,
                    end=end_dt,
                    feed=args.feed,
                    limit=args.limit,
                    page_token=token,
                )
                chunk = payload.get("bars") or []
                sym_bars.extend(chunk)
                token = payload.get("next_page_token")
                if not token:
                    break

            if args.dry_run:
                print(f"{sym}: would insert {len(sym_bars)} bars")
            else:
                assert conn is not None
                n = upsert_bars(conn, sym, sym_bars, asset_class=args.asset_class, exchange=args.exchange)
                total_rows += n
                print(f"{sym}: inserted {n} new rows ({len(sym_bars)} fetched)")

            if args.sleep and i + 1 < len(symbols):
                time.sleep(args.sleep)
    finally:
        if conn is not None:
            conn.close()

    if not args.dry_run:
        print(f"Done. New rows reported (ON CONFLICT skipped duplicates): {total_rows}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
