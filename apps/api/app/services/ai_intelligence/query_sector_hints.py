"""Map user query text to ticker hints for intent boosting (+15 plan)."""

from __future__ import annotations

import re


def sector_symbols_for_query(query: str) -> frozenset[str]:
    q = (query or "").lower()
    out: set[str] = set()
    if re.search(r"\bai\b|artificial\s+intelligence|machine\s+learning", q):
        out.update({"FET", "TAO", "RNDR", "WLD"})
    if re.search(r"\bl2\b|layer\s*2|rollup|arbitrum|optimism|starknet", q):
        out.update({"ARB", "OP", "STRK"})
    if re.search(r"\bmeme|doge|pepe|shib|bonk", q):
        out.update({"DOGE", "PEPE", "SHIB"})
    if re.search(r"\bdepin|de-pin|helium|filecoin|\bfil\b", q):
        out.update({"HNT", "FIL"})
    if re.search(r"\bgaming|gamefi|metaverse|axie", q):
        out.update({"AXS", "IMX", "SAND"})
    if re.search(r"\brwa|tokenized|ondo|blackrock", q):
        out.update({"ONDO", "MKR"})
    return frozenset(out)
