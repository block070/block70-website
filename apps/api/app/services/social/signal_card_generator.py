"""
Generate shareable signal card images for social sharing.

Image includes: token symbol, signal type, confidence score, timestamp, Block70 branding.
"""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any

from PIL import Image, ImageDraw, ImageFont

# Card dimensions (Twitter-friendly)
CARD_WIDTH = 1200
CARD_HEIGHT = 630
BG_COLOR = (15, 15, 25)
ACCENT_COLOR = (99, 102, 241)  # Indigo
TEXT_WHITE = (255, 255, 255)
TEXT_MUTED = (160, 160, 180)


def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
        except OSError:
            return ImageFont.load_default()


def generate_signal_card(
    token_symbol: str,
    signal_type: str,
    confidence_score: float,
    created_at: datetime | None = None,
    title: str | None = None,
    *,
    format: str = "PNG",
) -> bytes:
    """
    Generate a shareable signal card image as bytes.

    Args:
        token_symbol: e.g. "SOL", "ETH"
        signal_type: e.g. "buy", "accumulation"
        confidence_score: 0.0–1.0
        created_at: signal timestamp
        title: optional headline
        format: "PNG" or "JPEG"

    Returns:
        Image bytes suitable for response or upload.
    """
    img = Image.new("RGB", (CARD_WIDTH, CARD_HEIGHT), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    ts = created_at or datetime.utcnow()
    time_str = ts.strftime("%Y-%m-%d %H:%M UTC")
    confidence_pct = round(confidence_score * 100)

    font_lg = _get_font(72)
    font_md = _get_font(42)
    font_sm = _get_font(28)

    # Token symbol – large
    draw.text((80, 120), token_symbol or "—", fill=ACCENT_COLOR, font=font_lg)

    # Signal type
    draw.text((80, 220), signal_type or "Signal", fill=TEXT_WHITE, font=font_md)

    # Optional title (one line)
    if title:
        draw.text((80, 300), title[:60] + ("…" if len(title) > 60 else ""), fill=TEXT_MUTED, font=font_sm)

    # Confidence
    draw.text((80, 380), f"Confidence: {confidence_pct}%", fill=TEXT_WHITE, font=font_md)

    # Timestamp
    draw.text((80, 450), time_str, fill=TEXT_MUTED, font=font_sm)

    # Block70 branding
    draw.text((80, CARD_HEIGHT - 70), "Block70", fill=ACCENT_COLOR, font=font_md)
    draw.text((280, CARD_HEIGHT - 70), "Alpha & signals for crypto", fill=TEXT_MUTED, font=font_sm)

    buf = io.BytesIO()
    img.save(buf, format=format, optimize=True)
    return buf.getvalue()
