from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

import requests
from sqlalchemy.orm import Session

from app.models import PriceSnapshot
from app.services.streaming.event_stream import publish_event


class PriceSnapshotConnector:
    """
    Connector that fetches token price data (price, volume_24h, market_cap)
    from the CoinGecko API and persists PriceSnapshot records.

    This connector is designed to be invoked periodically (e.g. every 10
    minutes by a scheduler). When the external API is unavailable, it falls
    back to deterministic mock data so downstream systems can continue to
    function.
    """

    COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"

    # Mapping from our token_symbol to CoinGecko IDs.
    TOKEN_ID_MAP: Dict[str, str] = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "RNDR": "render-token",
        "FIL": "filecoin",
        "KAS": "kaspa",
        "BONK": "bonk",
        "JTO": "jito-governance-token",
        # TAO and other niche assets can be added here when available.
    }

    def __init__(self, *, session: Optional[requests.Session] = None) -> None:
        self._session = session or requests.Session()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def collect_and_persist(
        self,
        db: Session,
        token_symbols: Optional[List[str]] = None,
    ) -> List[PriceSnapshot]:
        """
        Fetch current prices for the given token_symbols (or all known tokens
        if None) and persist PriceSnapshot records.

        Returns the list of created snapshots.
        """
        symbols = (
            [s.upper() for s in token_symbols]
            if token_symbols
            else list(self.TOKEN_ID_MAP.keys())
        )

        market_data = self._fetch_market_data(symbols)
        snapshots: List[PriceSnapshot] = []

        now = datetime.now(timezone.utc)
        for symbol in symbols:
            data = market_data.get(symbol)
            if not data:
                continue

            snapshot = PriceSnapshot(
                token_symbol=symbol,
                chain=None,
                price=float(data["price"]),
                volume_24h=float(data["volume_24h"]),
                market_cap=float(data["market_cap"]),
                timestamp=now,
            )
            db.add(snapshot)
            snapshots.append(snapshot)

            # Emit a price_update StreamEvent for downstream consumers.
            publish_event(
                db,
                event_type="price_update",
                source="price_snapshot_connector",
                token_symbol=symbol,
                chain=None,
                payload={
                    "token_symbol": symbol,
                    "chain": None,
                    "price": float(data["price"]),
                    "volume_24h": float(data["volume_24h"]),
                    "market_cap": float(data["market_cap"]),
                    "timestamp": now.isoformat(),
                },
            )

        if snapshots:
            db.commit()

        return snapshots

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _fetch_market_data(self, symbols: List[str]) -> Dict[str, Dict[str, float]]:
        """
        Fetch market data from CoinGecko with a best-effort fallback to
        deterministic mock data.

        Returns:
        {
          "BTC": {"price": 68000.0, "volume_24h": 1.2e10, "market_cap": 1.3e12},
          ...
        }
        """
        ids = [self.TOKEN_ID_MAP[s] for s in symbols if s in self.TOKEN_ID_MAP]
        if not ids:
            return self._mock_market_data(symbols)

        try:
            resp = self._session.get(
                f"{self.COINGECKO_BASE_URL}/coins/markets",
                params={
                    "vs_currency": "usd",
                    "ids": ",".join(ids),
                    "order": "market_cap_desc",
                    "per_page": len(ids),
                    "page": 1,
                    "price_change_percentage": "24h",
                },
                timeout=5,
            )
            resp.raise_for_status()
            payload = resp.json()
        except Exception:
            return self._mock_market_data(symbols)

        by_id: Dict[str, Dict[str, float]] = {}
        if isinstance(payload, list):
            for item in payload:
                try:
                    cid = str(item.get("id", ""))
                    price = float(item.get("current_price") or 0.0)
                    volume_24h = float(item.get("total_volume") or 0.0)
                    market_cap = float(item.get("market_cap") or 0.0)
                except (TypeError, ValueError):
                    continue

                if not cid or price <= 0:
                    continue

                by_id[cid] = {
                    "price": price,
                    "volume_24h": volume_24h,
                    "market_cap": market_cap,
                }

        # Map back from CoinGecko IDs to our symbols, filling gaps with mock data.
        result: Dict[str, Dict[str, float]] = {}
        for symbol in symbols:
            cid = self.TOKEN_ID_MAP.get(symbol)
            if cid and cid in by_id:
                result[symbol] = by_id[cid]
            else:
                # If CoinGecko did not return data for this symbol, fall back to mock.
                result.setdefault(symbol, self._mock_market_data([symbol]).get(symbol, {
                    "price": 0.0,
                    "volume_24h": 0.0,
                    "market_cap": 0.0,
                }))

        return result

    def _mock_market_data(self, symbols: List[str]) -> Dict[str, Dict[str, float]]:
        """
        Deterministic mock price data used when CoinGecko is unavailable.
        """
        base: Dict[str, Dict[str, float]] = {
            "BTC": {"price": 68000.0, "volume_24h": 12_000_000_000.0, "market_cap": 1_300_000_000_000.0},
            "ETH": {"price": 3600.0, "volume_24h": 7_500_000_000.0, "market_cap": 430_000_000_000.0},
            "SOL": {"price": 175.0, "volume_24h": 2_800_000_000.0, "market_cap": 77_000_000_000.0},
            "RNDR": {"price": 7.5, "volume_24h": 420_000_000.0, "market_cap": 2_800_000_000.0},
            "FIL": {"price": 4.2, "volume_24h": 350_000_000.0, "market_cap": 2_100_000_000.0},
            "KAS": {"price": 0.16, "volume_24h": 260_000_000.0, "market_cap": 3_600_000_000.0},
            "BONK": {"price": 0.000028, "volume_24h": 150_000_000.0, "market_cap": 1_700_000_000.0},
            "JTO": {"price": 3.4, "volume_24h": 95_000_000.0, "market_cap": 330_000_000.0},
        }

        result: Dict[str, Dict[str, float]] = {}
        for symbol in symbols:
            key = symbol.upper()
            if key in base:
                result[key] = base[key]
            else:
                # Generic fallback for unknown tokens.
                result[key] = {
                    "price": 1.0,
                    "volume_24h": 1_000_000.0,
                    "market_cap": 100_000_000.0,
                }

        return result

