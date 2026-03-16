"""
DEX liquidity pool connector.

Fetches normalized pool data from Raydium and Orca. Uses mock data when
live APIs are not configured; real endpoints can be wired via environment
variables later.
"""

from __future__ import annotations

import os
from typing import List, Optional

import requests
from pydantic import BaseModel


class DexPoolRecord(BaseModel):
    """
    Normalized liquidity pool record: pair, liquidity, volume, fees.
    Maps to LiquidityPool model (dex, pair, token_a, token_b, liquidity_usd, volume_24h, fee_percent).
    """

    dex: str
    pair: str
    token_a: str
    token_b: str
    liquidity: float  # liquidity_usd
    volume: float  # volume_24h
    fees: float  # fee_percent


class DexPoolConnector:
    """
    Fetches liquidity pool data from Raydium and Orca.

    Returns normalized DexPoolRecord list suitable for persisting to
    LiquidityPool or driving liquidity_change stream events.
    """

    # Raydium / Orca API base URLs (optional; when unset, mock data is used)
    RAYDIUM_API = "https://api.raydium.io"
    ORCA_API = "https://api.orca.so"

    def __init__(self, session: Optional[requests.Session] = None) -> None:
        self._session = session or requests.Session()
        self._use_live = os.getenv("DEX_POOL_LIVE", "").lower() in ("1", "true", "yes")

    def fetch_pools(self) -> List[DexPoolRecord]:
        """
        Fetch pool data from Raydium and Orca, returning a single list of
        normalized records (pair, liquidity, volume, fees).
        """
        records: List[DexPoolRecord] = []

        if self._use_live:
            records.extend(self._fetch_raydium_pools())
            records.extend(self._fetch_orca_pools())

        if not records:
            records = self._mock_pools()

        return records

    def _fetch_raydium_pools(self) -> List[DexPoolRecord]:
        """Fetch Raydium pool data from public API when available."""
        records: List[DexPoolRecord] = []
        try:
            # Raydium v2 pools summary endpoint (example; adjust to actual public API)
            resp = self._session.get(
                f"{self.RAYDIUM_API}/v2/main/raydium/pool/info/list",
                timeout=10,
            )
            if resp.status_code != 200:
                return records
            data = resp.json()
            if not isinstance(data, list):
                return records
            for item in data[:50]:  # cap for safety
                try:
                    pair = self._raydium_pair(item)
                    if not pair:
                        continue
                    token_a, token_b = pair
                    records.append(
                        DexPoolRecord(
                            dex="Raydium",
                            pair=f"{token_a}/{token_b}",
                            token_a=token_a,
                            token_b=token_b,
                            liquidity=float(item.get("liquidity", 0) or 0),
                            volume=float(item.get("volume_24h", 0) or 0),
                            fees=float(item.get("fee_rate", 0) or 0) * 100.0,
                        )
                    )
                except (TypeError, ValueError, KeyError):
                    continue
        except Exception:
            pass
        return records

    @staticmethod
    def _raydium_pair(item: dict) -> Optional[tuple]:
        """Extract (token_a, token_b) from Raydium pool item if possible."""
        # Adapt keys to actual API response shape
        mint_a = item.get("mint_a") or item.get("baseMint") or item.get("token_a")
        mint_b = item.get("mint_b") or item.get("quoteMint") or item.get("token_b")
        if mint_a and mint_b:
            # Use symbol if provided, else mint address (shortened for display)
            a = str(mint_a)[:8] if len(str(mint_a)) > 10 else str(mint_a)
            b = str(mint_b)[:8] if len(str(mint_b)) > 10 else str(mint_b)
            return (a, b)
        name = item.get("name") or item.get("pair")
        if isinstance(name, str) and "/" in name:
            parts = name.split("/", 1)
            return (parts[0].strip(), parts[1].strip())
        return None

    def _fetch_orca_pools(self) -> List[DexPoolRecord]:
        """Fetch Orca pool data from public API when available."""
        records: List[DexPoolRecord] = []
        try:
            # Orca whitelist / pool list (example; adjust to actual public API)
            resp = self._session.get(
                f"{self.ORCA_API}/v1/whitelist",
                timeout=10,
            )
            if resp.status_code != 200:
                return records
            data = resp.json()
            # If API returns pool list with liquidity/volume/fees, normalize here
            if isinstance(data, list):
                for item in data[:50]:
                    try:
                        pair = self._orca_pair(item)
                        if not pair:
                            continue
                        token_a, token_b = pair
                        records.append(
                            DexPoolRecord(
                                dex="Orca",
                                pair=f"{token_a}/{token_b}",
                                token_a=token_a,
                                token_b=token_b,
                                liquidity=float(item.get("liquidity", 0) or item.get("tvl", 0) or 0),
                                volume=float(item.get("volume_24h", 0) or item.get("volume", 0) or 0),
                                fees=float(item.get("fee", 0) or item.get("fee_percent", 0) or 0),
                            )
                        )
                    except (TypeError, ValueError, KeyError):
                        continue
        except Exception:
            pass
        return records

    @staticmethod
    def _orca_pair(item: dict) -> Optional[tuple]:
        """Extract (token_a, token_b) from Orca pool item if possible."""
        name = item.get("name") or item.get("symbol") or item.get("pair")
        if isinstance(name, str) and "/" in name:
            parts = name.split("/", 1)
            return (parts[0].strip(), parts[1].strip())
        token_a = item.get("token_a") or item.get("mint_a") or item.get("base")
        token_b = item.get("token_b") or item.get("mint_b") or item.get("quote")
        if token_a and token_b:
            return (str(token_a), str(token_b))
        return None

    @staticmethod
    def _mock_pools() -> List[DexPoolRecord]:
        """Deterministic mock pool data for Raydium and Orca when live APIs are off."""
        return [
            # Raydium
            DexPoolRecord(
                dex="Raydium",
                pair="SOL/USDC",
                token_a="SOL",
                token_b="USDC",
                liquidity=750_000.0,
                volume=2_100_000.0,
                fees=0.25,
            ),
            DexPoolRecord(
                dex="Raydium",
                pair="BONK/USDC",
                token_a="BONK",
                token_b="USDC",
                liquidity=220_000.0,
                volume=480_000.0,
                fees=0.30,
            ),
            DexPoolRecord(
                dex="Raydium",
                pair="JUP/USDC",
                token_a="JUP",
                token_b="USDC",
                liquidity=600_000.0,
                volume=950_000.0,
                fees=0.25,
            ),
            # Orca
            DexPoolRecord(
                dex="Orca",
                pair="SOL/USDC",
                token_a="SOL",
                token_b="USDC",
                liquidity=650_000.0,
                volume=1_800_000.0,
                fees=0.30,
            ),
            DexPoolRecord(
                dex="Orca",
                pair="BONK/USDC",
                token_a="BONK",
                token_b="USDC",
                liquidity=180_000.0,
                volume=320_000.0,
                fees=0.30,
            ),
            DexPoolRecord(
                dex="Orca",
                pair="JUP/USDC",
                token_a="JUP",
                token_b="USDC",
                liquidity=500_000.0,
                volume=720_000.0,
                fees=0.25,
            ),
        ]
