"""
Convert signals into formatted messages for Telegram and Discord.
"""

from __future__ import annotations

from typing import Any

from app.services.bots.signal_link_generator import get_signal_page_url


def format_signal_message(
    token_symbol: str | None,
    signal_type: str,
    confidence_score: float,
    description: str | None,
    signal_id: int,
    chain: str | None = None,
    title: str | None = None,
    *,
    for_telegram: bool = True,
) -> str:
    """
    Build a single message string for a signal.
    for_telegram: use Telegram-friendly formatting (no markdown blocks that break in Telegram).
    """
    token = token_symbol or "—"
    confidence_pct = round(confidence_score * 100)
    link = get_signal_page_url(signal_id, token if token != "—" else None)

    lines = [
        f"🔔 {title or signal_type.replace('_', ' ').title()}",
        f"Token: {token}",
        f"Type: {signal_type.replace('_', ' ')}",
        f"Confidence: {confidence_pct}%",
    ]
    if chain:
        lines.append(f"Chain: {chain}")
    if description:
        desc = (description[:200] + "…") if len(description) > 200 else description
        lines.append(f"Description: {desc}")
    lines.append(f"")
    lines.append(f"👉 View on Block70: {link}")

    return "\n".join(lines)


def format_signal_telegram_html(
    token_symbol: str | None,
    signal_type: str,
    confidence_score: float,
    description: str | None,
    signal_id: int,
    chain: str | None = None,
    title: str | None = None,
) -> str:
    """Telegram HTML format (for parse_mode='HTML')."""
    token = token_symbol or "—"
    confidence_pct = round(confidence_score * 100)
    link = get_signal_page_url(signal_id, token if token != "—" else None)
    parts = [
        f"🔔 <b>{title or signal_type.replace('_', ' ').title()}</b>",
        f"Token: <code>{token}</code>",
        f"Type: {signal_type.replace('_', ' ')}",
        f"Confidence: {confidence_pct}%",
    ]
    if chain:
        parts.append(f"Chain: {chain}")
    if description:
        desc = (description[:200] + "…") if len(description) > 200 else description
        parts.append(f"Description: {desc}")
    parts.append(f"")
    parts.append(f'👉 <a href="{link}">View on Block70</a>')
    return "\n".join(parts)


def format_signal_discord_embed(
    token_symbol: str | None,
    signal_type: str,
    confidence_score: float,
    description: str | None,
    signal_id: int,
    chain: str | None = None,
    title: str | None = None,
) -> dict[str, Any]:
    """Discord embed payload for webhook."""
    token = token_symbol or "—"
    confidence_pct = round(confidence_score * 100)
    link = get_signal_page_url(signal_id, token if token != "—" else None)
    embed = {
        "title": title or f"{signal_type.replace('_', ' ').title()}",
        "description": description[:1000] if description else "No description",
        "url": link,
        "color": 0x6366F1,
        "fields": [
            {"name": "Token", "value": token, "inline": True},
            {"name": "Type", "value": signal_type.replace("_", " "), "inline": True},
            {"name": "Confidence", "value": f"{confidence_pct}%", "inline": True},
        ],
        "footer": {"text": "Block70"},
    }
    if chain:
        embed["fields"].append({"name": "Chain", "value": chain, "inline": True})
    return embed
