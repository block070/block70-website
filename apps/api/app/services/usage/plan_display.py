from __future__ import annotations

# List prices (USD / month) — align with web pricing page; not Stripe invoice amounts.
ESTIMATED_MONTHLY_USD: dict[str, int] = {
    "free": 0,
    "pro": 29,
    "elite": 99,
    "quant": 299,
}

# Enforced daily caps for AI search (rolling 24h); None = unlimited.
AI_DAILY_LIMITS: dict[str, int | None] = {
    "free": 5,
    "pro": 50,
    "elite": None,
    "quant": None,
    "admin": None,
}

# Display-only monthly caps for dashboard “remaining”; enforcement is separate.
AI_MONTHLY_LIMITS: dict[str, int | None] = {
    "free": 100,
    "pro": 5_000,
    "elite": None,
    "quant": None,
}

SIGNALS_MONTHLY_LIMITS: dict[str, int | None] = {
    "free": 500,
    "pro": 50_000,
    "elite": None,
    "quant": None,
}
