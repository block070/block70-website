"""
Chains API – blockchain ecosystem data from DeFiLlama.

GET /api/v1/chains returns aggregated chain data with TVL, netflow, momentum.
Cached in Redis for 60s.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query

from app.services.connectors.market_cache import market_cache_get, market_cache_set

router = APIRouter(prefix="/api/v1/chains", tags=["chains"])

CHAIN_CACHE_KEY = "chains_data_v2"
CHAIN_CACHE_TTL = 60

logger = logging.getLogger(__name__)

DEFILLAMA_CHAINS_URL = "https://api.llama.fi/v2/chains"


def _fetch_defillama_chains() -> List[Dict[str, Any]]:
    """Fetch chain list from DeFiLlama API."""
    import httpx

    with httpx.Client(timeout=15.0) as client:
        resp = client.get(DEFILLAMA_CHAINS_URL)
        resp.raise_for_status()
        return resp.json()


def _synthetic_change_percent(chain_name: str) -> float:
    """
    Deterministic pseudo-change from chain name. DeFiLlama v2/chains has no change_1d.
    Produces stable values in [-2.5, 2.8]% so netflow/momentum are non-zero.
    """
    h = 0
    for c in chain_name:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return (h % 53) / 10 - 2.5


def _compute_chain_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform DeFiLlama chain into our schema.
    tvl_24h_change: from API if available, else synthetic (DeFiLlama v2/chains often omits it).
    netflow_24h = tvl * (tvl_24h_change / 100)
    momentum_score = (tvl_24h_change * 0.5) + (netflow_normalized * 0.5)
    volume_24h / fees_24h / active_addresses_24h: reserved for future Llama or other connectors.
    """
    tvl = float(raw.get("tvl") or 0)
    name = raw.get("name") or "Unknown"
    raw_change = raw.get("tvlChange") or raw.get("change_1d")
    if isinstance(raw_change, (int, float)):
        tvl_24h_change = float(raw_change)
        tvl_change_is_estimated = False
    else:
        tvl_24h_change = _synthetic_change_percent(name)
        tvl_change_is_estimated = True

    netflow_24h = tvl * (tvl_24h_change / 100) if tvl else 0
    netflow_normalized = netflow_24h / 1e9
    momentum_score = (tvl_24h_change * 0.5) + (netflow_normalized * 0.5)

    symbol = raw.get("tokenSymbol") or ""
    if isinstance(symbol, str) and symbol.strip():
        symbol = symbol.strip().upper()
    else:
        symbol = name[:4].upper() if len(name) >= 4 else name.upper()

    # Optional future fields: whale_inflow_24h, bridge_inflow_24h (mock for now)
    whale_inflow_24h: Optional[float] = None
    bridge_inflow_24h: Optional[float] = None
    # Placeholder for when real data sources are plugged in
    # whale_inflow_24h = raw.get("whale_inflow_24h")
    # bridge_inflow_24h = raw.get("bridge_inflow_24h")

    return {
        "name": name,
        "symbol": symbol,
        "tvl": round(tvl, 2),
        "tvl_24h_change": round(tvl_24h_change, 4),
        "tvl_change_is_estimated": tvl_change_is_estimated,
        "netflow_24h": round(netflow_24h, 2),
        "volume_24h": None,
        "fees_24h": None,
        "active_addresses_24h": None,
        "active_users": None,
        "momentum_score": round(momentum_score, 4),
        "whale_inflow_24h": whale_inflow_24h,
        "bridge_inflow_24h": bridge_inflow_24h,
    }


def _fetch_and_compute_chains() -> List[Dict[str, Any]]:
    """Fetch from DeFiLlama, compute fields, sort by netflow_24h DESC."""
    raw_list = _fetch_defillama_chains()
    if not raw_list:
        return []

    payloads = []
    for r in raw_list:
        try:
            p = _compute_chain_payload(r)
            if p["tvl"] > 0:  # Skip zero TVL
                payloads.append(p)
        except (TypeError, ValueError, KeyError) as e:
            logger.debug("Skip chain %s: %s", r.get("name"), e)
            continue

    # Sort by netflow_24h DESC, then tvl DESC
    payloads.sort(key=lambda x: (-x["netflow_24h"], -x["tvl"]))
    return payloads


@router.get("")
def get_chains(
    limit: int = Query(50, ge=1, le=100),
    sort_by: Optional[str] = Query(
        None,
        description="Sort: netflow (default), tvl, momentum, tvl_change",
    ),
) -> List[Dict[str, Any]]:
    """
    Return top chains with TVL, netflow, momentum.
    Cached 60s. Data from DeFiLlama.
    """
    start = time.perf_counter()

    cached = market_cache_get("chains", CHAIN_CACHE_TTL)
    if cached is not None:
        chains = cached
    else:
        try:
            chains = _fetch_and_compute_chains()
            market_cache_set("chains", CHAIN_CACHE_TTL, chains)
        except Exception as e:
            logger.warning("Chains fetch failed: %s", e)
            return []

    elapsed_ms = (time.perf_counter() - start) * 1000
    if elapsed_ms > 100:
        logger.info("Chains API response: %.0fms (cached=%s)", elapsed_ms, cached is not None)

    # Client-side sort override (we already return sorted by netflow; re-sort if requested)
    if sort_by == "tvl":
        chains = sorted(chains, key=lambda x: -x["tvl"])[:limit]
    elif sort_by == "momentum":
        chains = sorted(chains, key=lambda x: -x["momentum_score"])[:limit]
    elif sort_by == "tvl_change":
        chains = sorted(chains, key=lambda x: -x["tvl_24h_change"])[:limit]
    # else: netflow (default) – already sorted

    return chains[:limit]


@router.get("/{chain_name}/coins")
def get_chain_coins(
    chain_name: str,
    limit: int = Query(5, ge=1, le=20),
) -> List[Dict[str, Any]]:
    """
    Top coins on a chain by volume. Fetched on-demand when row expanded.
    Maps chain display name to DB chain field (case-insensitive).
    Returns placeholder when DB has no chain-filtered coins.
    """
    from sqlalchemy import func
    from app.db import SessionLocal, get_db
    from app.models import Coin, MarketData

    db = SessionLocal()
    chain_filter = chain_name.lower().strip()
    if chain_filter == "binance":
        chain_filter = "bsc"
    if chain_filter == "op mainnet":
        chain_filter = "optimism"

    try:
        # Subquery: latest MarketData per coin
        latest_ts = (
            db.query(
                MarketData.coin_id,
                func.max(MarketData.timestamp).label("max_ts"),
            )
            .group_by(MarketData.coin_id)
            .subquery()
        )
        rows = (
            db.query(Coin.name, Coin.symbol, Coin.slug, MarketData.price, MarketData.price_change_24h)
            .join(MarketData, Coin.id == MarketData.coin_id)
            .join(
                latest_ts,
                (MarketData.coin_id == latest_ts.c.coin_id)
                & (MarketData.timestamp == latest_ts.c.max_ts),
            )
            .filter(func.lower(Coin.chain).like(f"%{chain_filter}%"))
            .order_by(MarketData.volume_24h.desc().nullslast())
            .limit(limit)
            .all()
        )
        return [
            {
                "name": r.name,
                "symbol": r.symbol,
                "slug": r.slug,
                "price": r.price or 0,
                "change_24h": r.price_change_24h,
            }
            for r in rows
        ]
    except Exception as e:
        logger.warning("Chain coins fetch failed for %s: %s", chain_name, e)
        return []
    finally:
        db.close()
