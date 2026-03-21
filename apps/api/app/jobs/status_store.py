"""
In-memory store for background job execution status.

Updated by scheduler event listeners. Used by /api/v1/status to show real-time service status.
"""

from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from typing import Any

# job_id -> {last_run_at, last_status, last_error, last_result?}
_job_status: dict[str, dict[str, Any]] = {}
_lock = Lock()

# Human-readable labels for job IDs
JOB_LABELS: dict[str, str] = {
    "news_scraper": "News scraper (RSS feeds every 5 min)",
    "coin_sync": "Coin sync (CoinGecko every 30 min)",
    "market_data_refresh": "Market data (prices every 5 min)",
    "radar_scan": "Radar pipeline",
    "signal_detection": "Signal detection",
    "arbitrage_scan": "Arbitrage scan",
    "miner_scan": "Miner ROI scan",
    "wallet_scan": "Wallet tracker",
    "airdrop_refresh": "Airdrop refresh",
    "event_consumer": "Event consumer",
    "liquidity_monitor": "Liquidity monitor",
    "signal_cluster": "Signal cluster",
    "alpha_snapshot_hourly": "Alpha snapshot (hourly)",
    "alpha_snapshot_daily": "Alpha snapshot (daily)",
    "daily_briefing": "Daily briefing",
    "opportunity_hunter": "Opportunity hunter",
    "backtest_scan": "Backtest engine",
    "trade_simulations": "Trade simulations",
    "ai_opportunity_analysis": "AI opportunity analysis",
    "signal_bot_dispatcher": "Signal bot dispatcher",
}


def record_job_success(job_id: str, result: Any = None) -> None:
    with _lock:
        _job_status[job_id] = {
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_status": "success",
            "last_error": None,
            "last_result": result,
        }


def record_job_error(job_id: str, error: str) -> None:
    with _lock:
        _job_status[job_id] = {
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_status": "error",
            "last_error": error,
            "last_result": None,
        }


def get_all_status() -> dict[str, dict[str, Any]]:
    with _lock:
        return dict(_job_status)


def get_job_status(job_id: str) -> dict[str, Any] | None:
    with _lock:
        return _job_status.get(job_id)
