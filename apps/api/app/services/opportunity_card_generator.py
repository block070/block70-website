from __future__ import annotations

import os
import textwrap
import uuid
from datetime import datetime
from typing import Optional

from app.models import Opportunity

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover - optional dependency
    raise RuntimeError(
        "Pillow is required for opportunity share card generation. "
        "Install it with `pip install Pillow` and try again."
    ) from exc


DEFAULT_WIDTH = 1200
DEFAULT_HEIGHT = 630


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """
    Best-effort font loader.

    Tries to use a semi-modern sans font if available, otherwise falls back to
    Pillow's default font.
    """
    # Common font paths on Linux / macOS – this is best-effort only.
    candidates = [
        "/usr/share/fonts/truetype/inter/Inter-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> str:
    """
    Simple word-wrap helper that ensures text fits within max_width.
    """
    if not text:
        return ""

    words = text.split()
    lines: list[str] = []
    current: list[str] = []

    for word in words:
        test_line = " ".join(current + [word])
        w, _ = draw.textsize(test_line, font=font)
        if w <= max_width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]

    if current:
        lines.append(" ".join(current))

    return "\n".join(lines)


def generate_opportunity_share_card(
    opportunity: Opportunity,
    *,
    output_dir: str = "./share_cards",
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
) -> str:
    """
    Generate a shareable PNG image summarizing an Opportunity.

    The card includes:
    - title
    - token symbol
    - estimated ROI
    - total score
    - confidence_score
    - summary

    Returns the absolute path to the generated PNG file.
    """
    os.makedirs(output_dir, exist_ok=True)

    # Derive key display fields
    title = opportunity.title or "Block70 Opportunity"
    token = opportunity.asset_symbol or opportunity.base_symbol or "Token"
    roi = opportunity.estimated_roi_percent
    score = opportunity.total_score
    confidence = opportunity.confidence_score
    summary = opportunity.summary or "Research-grade crypto opportunity surfaced by the Block70 Alpha Network."

    # Create base image
    img = Image.new("RGB", (width, height), color=(7, 14, 30))
    draw = ImageDraw.Draw(img)

    # Fonts
    title_font = _load_font(50)
    subtitle_font = _load_font(26)
    body_font = _load_font(22)
    small_font = _load_font(18)

    padding = 64
    inner_width = width - padding * 2

    # Header stripe
    header_height = 72
    draw.rectangle(
        [(0, 0), (width, header_height)],
        fill=(7, 26, 48),
    )
    draw.text(
        (padding, header_height / 2 - 14),
        "BLOCK70 · ALPHA NETWORK",
        font=small_font,
        fill=(148, 163, 184),
    )
    draw.text(
        (width - padding - 260, header_height / 2 - 14),
        "CRYPTO OPPORTUNITY INTELLIGENCE",
        font=small_font,
        fill=(56, 189, 248),
    )

    y = header_height + 40

    # Title
    wrapped_title = _wrap_text(draw, title, title_font, inner_width)
    draw.text((padding, y), wrapped_title, font=title_font, fill=(226, 232, 240))
    title_bbox = draw.multiline_textbbox((padding, y), wrapped_title, font=title_font)
    y = title_bbox[3] + 20

    # Token + type line
    type_label = opportunity.type.upper()
    token_line = f"{token}  ·  {type_label}"
    draw.text((padding, y), token_line, font=subtitle_font, fill=(148, 163, 184))
    y += 40

    # Stats row
    stat_y = y
    stat_x = padding
    stat_gap = 220

    def draw_stat(label: str, value: str, x: int, y_: int) -> None:
        draw.text((x, y_), label.upper(), font=small_font, fill=(100, 116, 139))
        draw.text((x, y_ + 24), value, font=subtitle_font, fill=(45, 212, 191))

    roi_text = f"{roi:.1f}%" if roi is not None else "N/A"
    score_text = f"{score * 100:.0f}%" if score is not None else "N/A"
    conf_text = f"{confidence * 100:.0f}%" if confidence is not None else "N/A"

    draw_stat("Est. ROI", roi_text, stat_x, stat_y)
    draw_stat("Score", score_text, stat_x + stat_gap, stat_y)
    draw_stat("Confidence", conf_text, stat_x + stat_gap * 2, stat_y)

    y = stat_y + 90

    # Summary block
    draw.text(
        (padding, y),
        "Thesis",
        font=small_font,
        fill=(148, 163, 184),
    )
    y += 26

    wrapped_summary = _wrap_text(draw, summary, body_font, inner_width)
    draw.multiline_text(
        (padding, y),
        wrapped_summary,
        font=body_font,
        fill=(203, 213, 225),
        spacing=4,
    )

    # Footer
    footer_text = f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} · block70"
    draw.text(
        (padding, height - padding + 8),
        footer_text,
        font=small_font,
        fill=(75, 85, 99),
    )

    # Save image
    filename = f"opportunity-{opportunity.id or uuid.uuid4().hex}.png"
    output_path = os.path.abspath(os.path.join(output_dir, filename))
    img.save(output_path, format="PNG")

    return output_path

