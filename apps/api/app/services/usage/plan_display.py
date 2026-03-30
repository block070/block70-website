from __future__ import annotations

# List prices (USD / month) — align with web pricing page; not Stripe invoice amounts.
ESTIMATED_MONTHLY_USD: dict[str, int] = {
    "free": 0,
    "pro": 19,
    "elite": 49,
}

# Display-only monthly caps for dashboard “remaining”; enforcement is separate.
AI_MONTHLY_LIMITS: dict[str, int | None] = {
    "free": 100,
    "pro": 5_000,
    "elite": None,
}

SIGNALS_MONTHLY_LIMITS: dict[str, int | None] = {
    "free": 500,
    "pro": 50_000,
    "elite": None,
}
