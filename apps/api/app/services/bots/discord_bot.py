"""
Send signals to Discord servers via Discord Webhook API.
"""

from __future__ import annotations

import requests

from app.services.bots.signal_formatter import format_signal_discord_embed


def send_discord_signal_alert(
    webhook_url: str,
    token_symbol: str | None,
    signal_type: str,
    confidence_score: float,
    description: str | None,
    signal_id: int,
    chain: str | None = None,
    title: str | None = None,
) -> tuple[bool, str]:
    """
    Send a signal as a Discord embed via webhook.
    webhook_url: Discord webhook URL (https://discord.com/api/webhooks/...).
    Returns (success, error_message or "").
    """
    embed = format_signal_discord_embed(
        token_symbol=token_symbol,
        signal_type=signal_type,
        confidence_score=confidence_score,
        description=description,
        signal_id=signal_id,
        chain=chain,
        title=title,
    )
    payload = {"embeds": [embed]}
    try:
        r = requests.post(webhook_url, json=payload, timeout=15)
        if r.status_code in (200, 204):
            return True, ""
        return False, r.text or str(r.status_code)
    except Exception as e:
        return False, str(e)
