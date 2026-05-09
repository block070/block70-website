#!/usr/bin/env python3
"""
Fetch current S&P 500 constituents from Wikipedia and write a canonical CSV.

Source: https://en.wikipedia.org/wiki/List_of_S%26P_500_companies
Run monthly or after index rebalance; commit updated CSV when it changes.

Usage (from repo root):
  python3 scripts/market/fetch_sp500_constituents.py
  python3 scripts/market/fetch_sp500_constituents.py --output data/market/sp500/constituents.csv

  On Windows you may use `python` instead of `python3`.
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
USER_AGENT = "Block70-sp500-fetch/1.0 (+https://github.com/block70)"


def _repo_root() -> Path:
    p = Path(__file__).resolve()
    for parent in [p.parent] + list(p.parents):
        if (parent / "AGENTS.md").is_file():
            return parent
    return Path(__file__).resolve().parents[2]


def fetch_constituents_rows() -> list[dict[str, str]]:
    r = requests.get(
        WIKI_URL,
        timeout=60,
        headers={"User-Agent": USER_AGENT},
    )
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table", {"id": "constituents"})
    if table is None:
        raise RuntimeError("Could not find Wikipedia table#constituents — page layout may have changed.")

    header_cells = table.find_all("tr")[0].find_all("th")
    headers = [h.get_text(strip=True) for h in header_cells]
    # Normalize merged header quirks
    col_index = {name: i for i, name in enumerate(headers)}

    rows_out: list[dict[str, str]] = []
    for tr in table.find_all("tr")[1:]:
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue

        def cell(name: str) -> str:
            i = col_index.get(name)
            if i is None or i >= len(tds):
                return ""
            return tds[i].get_text(strip=True)

        symbol = cell("Symbol")
        if not symbol:
            continue
        # Wikipedia uses "." in class-B tickers (e.g. BRK.B); Alpaca generally matches SIP-style symbols.
        rows_out.append(
            {
                "symbol": symbol,
                "security_name": cell("Security"),
                "gics_sector": cell("GICSSector") or cell("GICS Sector"),
                "gics_sub_industry": cell("GICS Sub-Industry"),
                "headquarters": cell("Headquarters Location"),
                "date_added_index": cell("Date added"),
                "cik": cell("CIK"),
                "founded": cell("Founded"),
            }
        )

    if len(rows_out) < 400:
        raise RuntimeError(f"Expected ~500 S&P rows, got {len(rows_out)} — parser may be broken.")
    return rows_out


def write_csv(path: Path, rows: list[dict[str, str]], *, as_of: datetime) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "symbol",
        "security_name",
        "gics_sector",
        "gics_sub_industry",
        "headquarters",
        "date_added_index",
        "cik",
        "founded",
        "source",
        "as_of_utc",
    ]
    iso = as_of.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            out = {k: r.get(k, "") for k in fieldnames if k not in ("source", "as_of_utc")}
            out["source"] = WIKI_URL
            out["as_of_utc"] = iso
            w.writerow(out)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download S&P 500 constituents into CSV.")
    parser.add_argument(
        "--output",
        type=Path,
        default=_repo_root() / "data" / "market" / "sp500" / "constituents.csv",
        help="Output CSV path",
    )
    args = parser.parse_args()

    rows = fetch_constituents_rows()
    now = datetime.now(timezone.utc)
    write_csv(args.output, rows, as_of=now)
    print(f"Wrote {len(rows)} symbols to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
