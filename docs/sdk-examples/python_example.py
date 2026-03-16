"""
Block70 Developer API - Python example.
Use your API key from https://block70.com/developers
"""

import os
import requests

API_BASE = os.environ.get("BLOCK70_API_BASE", "https://api.block70.com")
API_KEY = os.environ.get("BLOCK70_API_KEY", "bk70_your_key_here")


def get(path: str, params: dict | None = None) -> dict | list:
    """GET request with X-API-Key header."""
    url = f"{API_BASE}/api/v1/dev{path}"
    r = requests.get(url, headers={"X-API-Key": API_KEY}, params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


# Signals
signals = get("/signals", {"limit": 10})
print("Latest signals:", len(signals), "items")

latest = get("/signals/latest", {"limit": 5})
sol_signals = get("/signals/SOL")

# Opportunities
opportunities = get("/opportunities", {"limit": 20})
print("Opportunities:", len(opportunities), "items")

# Market
prices = get("/market/prices", {"limit": 10})
trending = get("/market/trending", {"limit": 10})
gainers = get("/market/gainers")
losers = get("/market/losers")

# Airdrops
airdrops = get("/airdrops")
upcoming = get("/airdrops/upcoming")

# Wallets
wallets = get("/wallets", {"limit": 20})
# wallet = get("/wallets/0x...")
# txs = get("/wallets/0x.../transactions")

# Portfolio (requires authenticated user's portfolio)
# portfolio = get("/portfolio")
# tokens = get("/portfolio/tokens")
# perf = get("/portfolio/performance")

print("Done.")
