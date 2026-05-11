#!/usr/bin/env python3
"""
Pull crypto 1m candles from Coinbase Exchange API into Timescale `bars_1m`.

Requires MARKET_DATA_DATABASE_URL. No API keys for public candles.

Usage:
  python3 scripts/market/coinbase_bars_ingest.py --start 2026-05-08 --end 2026-05-10
  python3 scripts/market/coinbase_bars_ingest.py --symbols-from-warehouse --start 2026-05-08 --end 2026-05-10
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from warehouse_bars import connect_market_db, insert_bars, load_warehouse_symbols

COINBASE_EXCHANGE_BASE = "https://api.exchange.coinbase.com"
MAX_CANDLES_PER_REQUEST = 300


def _repo_root() -> Path:
    p = Path(__file__).resolve()
    for parent in [p.parent] + list(p.parents):
        if (parent / "AGENTS.md").is_file():
            return parent
    return Path(__file__).resolve().parents[2]


def load_symbols_from_file(path: Path) -> list[str]:
    symbols: list[str] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            symbols.append(s)
    return sorted(set(symbols))


def product_to_warehouse_symbol(product_id: str) -> str:
    if "-" in product_id:
        base, quote = product_id.split("-", 1)
        return f"{base}/{quote}"
    return product_id


def warehouse_symbol_to_product(symbol: str) -> str:
    s = symbol.strip()
    if "/" in s:
        base, quote = s.split("/", 1)
        return f"{base}-{quote}"
    if "-" in s:
        return s
    return f"{s}-USD"


def fetch_online_usd_products(session: requests.Session) -> list[str]:
    r = session.get(f"{COINBASE_EXCHANGE_BASE}/products", timeout=60)
    r.raise_for_status()
    products = r.json()
    out: list[str] = []
    for p in products:
        if not isinstance(p, dict):
            continue
        if p.get("status") != "online":
            continue
        if p.get("quote_currency") != "USD":
            continue
        pid = p.get("id")
        if pid:
            out.append(str(pid))
    return sorted(set(out))


def fetch_candles_window(
    session: requests.Session,
    product_id: str,
    *,
    start: datetime,
    end: datetime,
    granularity_sec: int,
) -> list[dict]:
    r = session.get(
        f"{COINBASE_EXCHANGE_BASE}/products/{product_id}/candles",
        params={
            "granularity": granularity_sec,
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
        timeout=60,
    )
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        return []
    bars: list[dict] = []
    for row in data:
        if len(row) < 6:
            continue
        ts_raw = int(row[0])
        if ts_raw > 1_000_000_000_000:
            ts_raw //= 1000
        bars.append(
            {
                "ts": datetime.fromtimestamp(ts_raw, tz=timezone.utc),
                "open": float(row[3]),
                "high": float(row[2]),
                "low": float(row[1]),
                "close": float(row[4]),
                "volume": float(row[5]),
            }
        )
    return bars


def fetch_all_candles(
    session: requests.Session,
    product_id: str,
    *,
    range_start: datetime,
    range_end: datetime,
    granularity_sec: int,
) -> list[dict]:
    step = timedelta(seconds=granularity_sec * MAX_CANDLES_PER_REQUEST)
    cursor = range_start
    all_bars: list[dict] = []
    while cursor < range_end:
        window_end = min(cursor + step, range_end)
        all_bars.extend(
            fetch_candles_window(
                session,
                product_id,
                start=cursor,
                end=window_end,
                granularity_sec=granularity_sec,
            )
        )
        cursor = window_end
    return all_bars


def main() -> int:
    p = argparse.ArgumentParser(description="Ingest Coinbase crypto candles into bars_1m.")
    p.add_argument("--start", required=True, help="UTC date YYYY-MM-DD (inclusive)")
    p.add_argument("--end", required=True, help="UTC date YYYY-MM-DD (exclusive)")
    p.add_argument(
        "--symbols-file",
        type=Path,
        default=_repo_root() / "data" / "market" / "crypto" / "coinbase_symbols.txt",
    )
    p.add_argument(
        "--symbols-from-warehouse",
        action="store_true",
        help="Use DISTINCT symbols already in bars_1m for this asset_class/exchange",
    )
    p.add_argument(
        "--all-usd-products",
        action="store_true",
        help="Ingest all online Coinbase USD products (ignore symbols file)",
    )
    p.add_argument("--asset-class", default="crypto")
    p.add_argument("--exchange", default="COINBASE")
    p.add_argument("--granularity-sec", type=int, default=60)
    p.add_argument("--sleep", type=float, default=0.15)
    p.add_argument("--max-symbols", type=int, default=0)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--on-conflict", action="store_true")
    p.add_argument(
        "--source",
        default=os.getenv("MARKET_BARS_SOURCE", "coinbase"),
    )
    args = p.parse_args()

    range_start = datetime.combine(date.fromisoformat(args.start), datetime.min.time(), tzinfo=timezone.utc)
    range_end = datetime.combine(date.fromisoformat(args.end), datetime.min.time(), tzinfo=timezone.utc)
    if range_start >= range_end:
        print("--start must be before --end (end is exclusive)", file=sys.stderr)
        return 1

    session = requests.Session()
    conn = None
    products: list[str] = []

    if args.all_usd_products:
        products = fetch_online_usd_products(session)
    elif args.symbols_from_warehouse:
        conn = connect_market_db()
        wh_symbols = load_warehouse_symbols(conn, asset_class=args.asset_class, exchange=args.exchange)
        products = [warehouse_symbol_to_product(s) for s in wh_symbols]
    elif args.symbols_file.is_file():
        raw = load_symbols_from_file(args.symbols_file)
        products = [warehouse_symbol_to_product(s) for s in raw]
    else:
        print(
            f"No symbol list: use --symbols-from-warehouse, --all-usd-products, or create {args.symbols_file}",
            file=sys.stderr,
        )
        return 1

    if args.max_symbols > 0:
        products = products[: args.max_symbols]

    if not products:
        print("No symbols/products to ingest", file=sys.stderr)
        return 1

    if not args.dry_run and conn is None:
        conn = connect_market_db()

    total_rows = 0
    try:
        for i, product_id in enumerate(products):
            wh_symbol = product_to_warehouse_symbol(product_id)
            bars = fetch_all_candles(
                session,
                product_id,
                range_start=range_start,
                range_end=range_end,
                granularity_sec=args.granularity_sec,
            )
            if args.dry_run:
                print(f"{wh_symbol}: would insert {len(bars)} bars")
            else:
                assert conn is not None
                n = insert_bars(
                    conn,
                    wh_symbol,
                    bars,
                    asset_class=args.asset_class,
                    exchange=args.exchange,
                    source=args.source,
                    use_on_conflict=args.on_conflict,
                )
                total_rows += n
                print(f"{wh_symbol}: inserted {n} new rows ({len(bars)} fetched)")

            if args.sleep and i + 1 < len(products):
                time.sleep(args.sleep)
    finally:
        if conn is not None:
            conn.close()

    if not args.dry_run:
        print(f"Done. New rows inserted: {total_rows}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
