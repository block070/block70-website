"""
Generate URLs linking back to Block70 signal pages.
"""

from __future__ import annotations

import os

BASE_URL = os.getenv("BLOCK70_BASE_URL", "https://block70.com")


def get_signal_page_url(signal_id: int, token: str | None = None) -> str:
    """URL to the signal detail page (e.g. /signals/SOL or /signals/{id})."""
    if token:
        return f"{BASE_URL.rstrip('/')}/signals/{token}"
    return f"{BASE_URL.rstrip('/')}/signals?id={signal_id}"


def get_signal_share_url(signal_id: int) -> str:
    """URL for sharing / viewing the signal (e.g. share card or feed)."""
    return f"{BASE_URL.rstrip('/')}/signals?signal={signal_id}"
