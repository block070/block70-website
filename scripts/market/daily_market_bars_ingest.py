#!/usr/bin/env python3
"""
Daily incremental ingest for crypto (Coinbase) and equity (Alpaca) into bars_1m.

Env:
  MARKET_DATA_DATABASE_URL (required)
  APCA_API_KEY_ID / APCA_API_SECRET_KEY (equity)
  MARKET_BARS_LOOKBACK_DAYS (default 3)
  ALPACA_DATA_FEED (default iex)

Usage:
  python3 scripts/market/daily_market_bars_ingest.py
  python3 scripts/market/daily_market_bars_ingest.py --lookback-days 5 --skip-crypto
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


def _repo_root() -> Path:
    p = Path(__file__).resolve()
    for parent in [p.parent] + list(p.parents):
        if (parent / "AGENTS.md").is_file():
            return parent
    return Path(__file__).resolve().parents[2]


def _utc_date_range(lookback_days: int) -> tuple[str, str]:
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=lookback_days)
    end = today + timedelta(days=1)
    return start.isoformat(), end.isoformat()


def _run(script: Path, args: list[str]) -> int:
    cmd = [sys.executable, str(script), *args]
    print("+", " ".join(cmd), flush=True)
    return subprocess.call(cmd)


def main() -> int:
    p = argparse.ArgumentParser(description="Run daily crypto + equity bars ingest.")
    p.add_argument(
        "--lookback-days",
        type=int,
        default=int(os.getenv("MARKET_BARS_LOOKBACK_DAYS", "3")),
        help="UTC calendar days to refresh (inclusive start, exclusive end is tomorrow UTC)",
    )
    p.add_argument("--skip-crypto", action="store_true")
    p.add_argument("--skip-equity", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    if not os.getenv("MARKET_DATA_DATABASE_URL", "").strip():
        print("Set MARKET_DATA_DATABASE_URL", file=sys.stderr)
        return 1

    start, end = _utc_date_range(args.lookback_days)
    print(f"UTC window: {start} .. {end} (end exclusive)", flush=True)

    root = _repo_root()
    market_dir = root / "scripts" / "market"
    status = 0

    common = ["--start", start, "--end", end]
    if args.dry_run:
        common.append("--dry-run")

    if not args.skip_crypto:
        crypto_args = [
            *common,
            "--symbols-from-warehouse",
            "--exchange",
            os.getenv("CRYPTO_BARS_EXCHANGE", "COINBASE"),
        ]
        rc = _run(market_dir / "coinbase_bars_ingest.py", crypto_args)
        if rc != 0:
            status = rc

    if not args.skip_equity:
        if not args.dry_run and not (
            os.getenv("APCA_API_KEY_ID") or os.getenv("ALPACA_API_KEY_ID")
        ):
            print("Skip equity: APCA_API_KEY_ID not set", file=sys.stderr)
        else:
            equity_args = [
                *common,
                "--symbols-file",
                str(root / "data" / "market" / "sp500" / "constituents.csv"),
                "--chunk-days",
                os.getenv("ALPACA_BARS_CHUNK_DAYS", "7"),
                "--sleep",
                os.getenv("ALPACA_BARS_SLEEP", "0.25"),
            ]
            rc = _run(market_dir / "alpaca_bars_ingest.py", equity_args)
            if rc != 0:
                status = rc

    return status


if __name__ == "__main__":
    sys.exit(main())
