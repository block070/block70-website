"""Upland-scoped API routes under /api/v1/upland/*.

Split into modules for readability:
  * entitlements.py      -- GET entitlements, feature-matrix parity
  * saved_searches.py    -- Pro+ filter persistence
  * api_keys.py          -- Elite-only scoped API keys
  * billing.py           -- Upland-specific Stripe checkout + portal
  * portfolio.py         -- Elite-only owner-wallet watches
  * alerts.py            -- Elite-only alert subscriptions

Each module exposes a `router` that the main app includes.
"""

from .entitlements import router as entitlements_router
from .saved_searches import router as saved_searches_router
from .api_keys import router as api_keys_router
from .billing import router as billing_router
from .portfolio import router as portfolio_router
from .alerts import router as alerts_router

__all__ = [
    "entitlements_router",
    "saved_searches_router",
    "api_keys_router",
    "billing_router",
    "portfolio_router",
    "alerts_router",
]
