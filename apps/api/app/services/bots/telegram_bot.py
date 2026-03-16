"""
Send signals to Telegram channels via Telegram Bot API.
"""

from __future__ import annotations

import requests

from app.services.bots.signal_formatter import format_signal_telegram_html

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


def send_telegram_message(
    bot_token: str,
    channel_id: str,
    text: str,
    parse_mode: str = "HTML",
    disable_web_page_preview: bool = True,
) -> tuple[bool, str]:
    """
    Send a text message to a Telegram channel.
    channel_id: @channel_username or -100xxxxxxxxxx
    Returns (success, error_message or response text).
    """
    url = TELEGRAM_API.format(token=bot_token)
    payload = {
        "chat_id": channel_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": disable_web_page_preview,
    }
    try:
        r = requests.post(url, json=payload, timeout=15)
        data = r.json()
        if not r.ok:
            return False, data.get("description", r.text) or str(r.status_code)
        return True, ""
    except Exception as e:
        return False, str(e)


def send_telegram_signal_alert(
    bot_token: str,
    channel_id: str,
    token_symbol: str | None,
    signal_type: str,
    confidence_score: float,
    description: str | None,
    signal_id: int,
    chain: str | None = None,
    title: str | None = None,
) -> tuple[bool, str]:
    """Format signal as Telegram message and send."""
    text = format_signal_telegram_html(
        token_symbol=token_symbol,
        signal_type=signal_type,
        confidence_score=confidence_score,
        description=description,
        signal_id=signal_id,
        chain=chain,
        title=title,
    )
    return send_telegram_message(bot_token, channel_id, text)
