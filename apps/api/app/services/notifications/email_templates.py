from __future__ import annotations

from typing import Any


def render_daily_digest_plain(
    user_name: str,
    segment: str,
    payload: dict[str, Any],
) -> tuple[str, str]:
    subject = "Block70 daily digest"
    lines = [
        f"Hi {user_name},",
        "",
        f"Here's your {segment} snapshot from Block70.",
        "",
        "Top signals (24h):",
    ]
    for s in payload.get("top_signals") or []:
        sym = s.get("token_symbol") or "—"
        lines.append(f"  - {sym}: {s.get('signal_type')} (confidence {float(s.get('confidence_score') or 0):.0%})")
    lines.append("")
    lines.append("Open the app for full context and opportunities.")
    lines.append("")
    lines.append("Not financial advice.")
    return subject, "\n".join(lines)


def render_signal_alert_plain(
    user_name: str,
    segment: str,
    token_symbol: str | None,
    signal_type: str,
    title: str | None,
    confidence: float,
) -> tuple[str, str]:
    sym = token_symbol or "token"
    subject = f"Block70 alert: {signal_type} · {sym}"
    body = "\n".join(
        [
            f"Hi {user_name},",
            "",
            f"A new signal may matter for your {segment} workflow:",
            f"  {title or signal_type}",
            f"  Token: {sym}",
            f"  Confidence: {confidence:.0%}",
            "",
            "Open Block70 for full detail and execution context.",
            "",
            "Not financial advice.",
        ]
    )
    return subject, body


def render_trial_expiring_plain(user_name: str, days_left: int) -> tuple[str, str]:
    subject = f"Your Block70 trial ends in {days_left} day(s)"
    body = "\n".join(
        [
            f"Hi {user_name},",
            "",
            f"Your Elite trial ends in about {days_left} day(s). Keep full score breakdowns and dense signals — upgrade before it lapses.",
            "",
            "https://block70.com/pricing",
            "",
            "Not financial advice.",
        ]
    )
    return subject, body


def render_reengage_plain(user_name: str, segment: str) -> tuple[str, str]:
    subject = "Block70 miss you — fresh signals inside"
    body = "\n".join(
        [
            f"Hi {user_name},",
            "",
            f"We saved your {segment} workspace. New narratives and signals landed — take a quick look.",
            "",
            "Not financial advice.",
        ]
    )
    return subject, body


def render_narrative_shift_plain(
    user_name: str,
    narrative_name: str,
    growth_hint: str,
) -> tuple[str, str]:
    subject = f"Narrative shift: {narrative_name}"
    body = "\n".join(
        [
            f"Hi {user_name},",
            "",
            f"Narrative activity change: {narrative_name}",
            growth_hint,
            "",
            "Open Block70 narratives for the full picture.",
            "",
            "Not financial advice.",
        ]
    )
    return subject, body
