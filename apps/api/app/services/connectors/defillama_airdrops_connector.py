from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import requests


@dataclass(frozen=True)
class DefiLlamaAirdropItem:
    key: str
    name: str
    description: Optional[str]
    page: Optional[str]
    twitter: Optional[str]
    token_symbol: Optional[str]
    is_active: bool


class DefiLlamaAirdropsConnector:
    """
    Free, real data source for airdrop candidates.

    Uses DefiLlama's open airdrop-checker config (public GitHub raw).
    This is not paid, and it is not a local seed: it's maintained externally.
    """

    CONFIG_URL = "https://raw.githubusercontent.com/DefiLlama/airdrop-checker/master/airdrop-config.json"

    def __init__(self, session: requests.Session | None = None) -> None:
        self._session = session or requests.Session()

    def fetch(self, *, active_only: bool = True, timeout_s: int = 10) -> List[DefiLlamaAirdropItem]:
        resp = self._session.get(self.CONFIG_URL, timeout=timeout_s)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict):
            return []

        out: List[DefiLlamaAirdropItem] = []
        for key, raw in data.items():
            if not isinstance(raw, dict):
                continue
            is_active = bool(raw.get("isActive")) if "isActive" in raw else False
            if active_only and not is_active:
                continue
            out.append(
                DefiLlamaAirdropItem(
                    key=str(key),
                    name=str(raw.get("name") or key),
                    description=(str(raw.get("description")) if raw.get("description") else None),
                    page=(str(raw.get("page")) if raw.get("page") else None),
                    twitter=(str(raw.get("twitter")) if raw.get("twitter") else None),
                    token_symbol=(str(raw.get("tokenSymbol")) if raw.get("tokenSymbol") else None),
                    is_active=is_active,
                )
            )
        return out

