"""Map symbols/slugs to narrative taxonomy for rotation and boosting."""

from __future__ import annotations

from typing import Iterable

NARRATIVE_IDS = (
    "AI",
    "L2",
    "MEME",
    "DEPIN",
    "GAMING",
    "RWA",
    "INFRA",
)

# Upper symbol OR lowercase slug fragment → narratives
_SYMBOL_TAGS: dict[str, frozenset[str]] = {
    "FET": frozenset({"AI"}),
    "TAO": frozenset({"AI"}),
    "RNDR": frozenset({"AI"}),
    "AGIX": frozenset({"AI"}),
    "OCEAN": frozenset({"AI"}),
    "WLD": frozenset({"AI"}),
    "ARB": frozenset({"L2"}),
    "OP": frozenset({"L2"}),
    "STRK": frozenset({"L2"}),
    "IMX": frozenset({"L2", "GAMING"}),
    "MATIC": frozenset({"L2"}),
    "POL": frozenset({"L2"}),
    "DOGE": frozenset({"MEME"}),
    "PEPE": frozenset({"MEME"}),
    "SHIB": frozenset({"MEME"}),
    "WIF": frozenset({"MEME"}),
    "BONK": frozenset({"MEME"}),
    "FLOKI": frozenset({"MEME"}),
    "HNT": frozenset({"DEPIN"}),
    "FIL": frozenset({"DEPIN"}),
    "RENDER": frozenset({"AI"}),
    "GRT": frozenset({"AI", "INFRA"}),
    "AXS": frozenset({"GAMING"}),
    "SAND": frozenset({"GAMING"}),
    "MANA": frozenset({"GAMING"}),
    "ONDO": frozenset({"RWA"}),
    "MKR": frozenset({"RWA", "INFRA"}),
    "LINK": frozenset({"INFRA"}),
    "ETH": frozenset({"INFRA"}),
    "SOL": frozenset({"INFRA"}),
    "AVAX": frozenset({"INFRA"}),
    "INJ": frozenset({"INFRA", "AI"}),
}

_SLUG_TAGS: dict[str, frozenset[str]] = {
    "fetch-ai": frozenset({"AI"}),
    "bittensor": frozenset({"AI"}),
    "render-token": frozenset({"AI"}),
    "arbitrum": frozenset({"L2"}),
    "optimism": frozenset({"L2"}),
    "starknet": frozenset({"L2"}),
    "dogecoin": frozenset({"MEME"}),
    "pepe": frozenset({"MEME"}),
    "helium": frozenset({"DEPIN"}),
    "filecoin": frozenset({"DEPIN"}),
}


def narratives_for_asset(symbol: str, slug: str) -> frozenset[str]:
    sym = (symbol or "").strip().upper()
    sl = (slug or "").strip().lower()
    out: set[str] = set()
    if sym in _SYMBOL_TAGS:
        out |= _SYMBOL_TAGS[sym]
    if sl in _SLUG_TAGS:
        out |= _SLUG_TAGS[sl]
    return frozenset(out)


def all_narrative_ids() -> tuple[str, ...]:
    return NARRATIVE_IDS
