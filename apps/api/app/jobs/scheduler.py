from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Callable

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.jobs.status_store import record_job_error, record_job_success

from app.db import SessionLocal
from app.agents.arbitrage_agent import run_arbitrage_scan
from app.agents.miner_agent import run_miner_scan
from app.agents.wallet_agent import run_wallet_scan
from app.services.pipeline.alpha_snapshot_pipeline import AlphaSnapshotPipeline
from app.services.pipeline.radar_pipeline import RadarPipeline
from app.services.pipeline.coin_sync_pipeline import CoinSyncPipeline
from app.services.pipeline.market_data_pipeline import MarketDataPipeline
from app.services.pipeline.description_backfill_pipeline import (
    DescriptionBackfillPipeline,
)
from app.services.backtesting.backtest_engine import BacktestEngine
from app.services.simulation.trade_simulator import TradeSimulator
from app.services.ai.analysis_pipeline import OpportunityAnalysisPipeline
from app.services.ai.daily_briefing_engine import DailyBriefingEngine
from app.services.pipeline.opportunity_hunter_pipeline import OpportunityHunterPipeline
from app.services.pipeline.liquidity_monitor import LiquidityMonitor
from app.services.pipeline.signal_cluster_pipeline import run_signal_cluster_pipeline
from app.services.pipeline.airdrop_pipeline import run_airdrop_pipeline
from app.services.streaming.event_consumer import run_event_consumer
from app.services.scrapers.news_scraper import run_news_scraper
from app.services.exchanges_pipeline import run_exchanges_sync
from app.services.bots.bot_dispatcher import run_signal_bot_dispatcher
from app.services.signals.signal_detection_engine import SignalDetectionEngine
import redis.exceptions
from app.models import (
    Opportunity,
    OpportunityStatus,
    OpportunitySignal,
    BacktestResult,
    SimulatedTrade,
    RadarSignal,
)


def _with_db_session(fn: Callable[[Session], None]) -> None:
    """
    Helper to execute an agent function with its own DB session.

    This keeps the scheduler decoupled from FastAPI's request-scoped
    dependencies and ensures jobs do not block API request handling.
    """
    db: Session | None = None
    try:
        db = SessionLocal()
        fn(db)
    finally:
        if db is not None:
            db.close()


def _run_arbitrage_job() -> None:
    _with_db_session(run_arbitrage_scan)


def _run_miner_job() -> None:
    _with_db_session(run_miner_scan)


def _run_wallet_job() -> None:
    _with_db_session(run_wallet_scan)


def _run_radar_job() -> None:
    def _job(db: Session) -> None:
        pipeline = RadarPipeline()
        pipeline.run(db)

    _with_db_session(_job)


def _run_alpha_hourly_job() -> None:
    def _job(db: Session) -> None:
        pipeline = AlphaSnapshotPipeline()
        pipeline.run(db, snapshot_type="hourly", top_n=5)

    _with_db_session(_job)


def _run_alpha_daily_job() -> None:
    def _job(db: Session) -> None:
        pipeline = AlphaSnapshotPipeline()
        pipeline.run(db, snapshot_type="daily", top_n=5)

    _with_db_session(_job)


def _run_backtest_job() -> None:
    def _job(db: Session) -> None:
        engine = BacktestEngine()
        # Select opportunities that are at least 7 days old and have not yet
        # been backtested.
        cutoff = datetime.utcnow() - timedelta(days=7)
        candidates = (
            db.query(Opportunity)
            .outerjoin(
                BacktestResult,
                BacktestResult.opportunity_id == Opportunity.id,
            )
            .filter(
                BacktestResult.id.is_(None),
                Opportunity.detected_at.isnot(None),
                Opportunity.detected_at <= cutoff,
            )
            .all()
        )
        for opp in candidates:
            engine.backtest_opportunity(db, opp)

    _with_db_session(_job)


def _run_trade_simulations_job() -> None:
    """
    Simulate trades for newly detected opportunities that have not yet
    been simulated.

    - "Newly detected" is approximated as detected within the last hour.
    - Only opportunities without an existing SimulatedTrade are considered,
      to avoid double-counting.
    """

    def _job(db: Session) -> None:
        simulator = TradeSimulator()

        cutoff = datetime.utcnow() - timedelta(hours=1)
        candidates = (
            db.query(Opportunity)
            .outerjoin(
                SimulatedTrade,
                SimulatedTrade.opportunity_id == Opportunity.id,
            )
            .filter(
                SimulatedTrade.id.is_(None),
                Opportunity.detected_at.isnot(None),
                Opportunity.detected_at >= cutoff,
            )
            .all()
        )

        for opp in candidates:
            simulator.simulate_for_opportunity(db, opp)

    _with_db_session(_job)


def _run_ai_analysis_job() -> None:
    """
    Run AI analysis on newly detected opportunities that do not yet have
    an associated OpportunityAnalysis.

    This job is intentionally scoped to a recent lookback window to keep
    latency and LLM usage bounded.
    """

    def _job(db: Session) -> None:
        pipeline = OpportunityAnalysisPipeline()
        # Analyze opportunities detected in the last few hours and missing analysis.
        pipeline.run(db, lookback_hours=6, max_items=25)

    _with_db_session(_job)


def _run_daily_briefing_job() -> None:
    """
    Generate a daily intelligence briefing summarizing the current state
    of top opportunities, radar events, and wallet-driven signals.

    This job is intended to run once per day (UTC) to create a single
    DailyBriefing record for that day.
    """

    def _job(db: Session) -> None:
        engine = DailyBriefingEngine()

        # Select a small set of top active opportunities across all types.
        top_opportunities = (
            db.query(Opportunity)
            .filter(Opportunity.status == OpportunityStatus.ACTIVE.value)
            .order_by(Opportunity.total_score.desc())
            .limit(20)
            .all()
        )

        # Recent radar signals as a proxy for radar events.
        recent_radar = (
            db.query(RadarSignal)
            .order_by(RadarSignal.created_at.desc())
            .limit(50)
            .all()
        )

        # Recent wallet-related signals (if any) for color in the brief.
        wallet_signals = (
            db.query(OpportunitySignal)
            .filter(OpportunitySignal.signal_type.ilike("%wallet%"))
            .order_by(OpportunitySignal.created_at.desc())
            .limit(50)
            .all()
        )

        # Placeholder for market data; upstream jobs or connectors can
        # populate a richer snapshot over time.
        market_data = {}

        engine.generate_daily_briefing(
            db,
            top_opportunities=top_opportunities,
            radar_events=recent_radar,
            wallet_signals=wallet_signals,
            market_data=market_data,
        )

    _with_db_session(_job)


def _run_opportunity_hunter_job() -> None:
    """
    Run the Opportunity Hunter pipeline to surface new CandidateProject
    records based on combined developer and social activity.
    """

    def _job(db: Session) -> None:
        pipeline = OpportunityHunterPipeline()
        pipeline.run(db)

    _with_db_session(_job)


def _run_liquidity_monitor_job() -> None:
    """Track pool liquidity/volume changes and emit liquidity radar signals."""

    def _job(db: Session) -> None:
        monitor = LiquidityMonitor()
        monitor.run(db)

    _with_db_session(_job)


def _run_signal_cluster_job() -> None:
    """Create signal_cluster opportunities from aggregated signals (every 10 min)."""

    def _job(db: Session) -> None:
        run_signal_cluster_pipeline(db, lookback_hours=24.0, min_confidence=0.5)

    _with_db_session(_job)


def _run_signal_detection_job() -> None:
    """
    Convert recent RadarSignal rows into normalized Signal rows.

    This is the primary producer for the /api/v1/signals feed.
    """

    def _job(db: Session) -> None:
        engine = SignalDetectionEngine()
        since = datetime.utcnow() - timedelta(minutes=30)
        engine.run_from_radar(db, since=since, limit=500)
        engine.run_from_opportunity_signals(db, since=since, limit=500)

    _with_db_session(_job)


def _run_airdrop_job() -> None:
    """Fetch and persist airdrop opportunities from real RSS feeds."""

    def _job(db: Session) -> None:
        run_airdrop_pipeline(db, limit=200)

    _with_db_session(_job)


def _run_event_consumer_job() -> None:
    """
    Background streaming consumer that continuously drains the Redis-backed
    event stream and forwards events into the signal extractors and
    Opportunity Engine.

    This job runs in the APScheduler background scheduler and never blocks
    the FastAPI request handlers.
    """

    def _job(db: Session) -> None:
        # Each tick consumes up to a bounded number of events and then
        # returns control to the scheduler. Multiple instances can run
        # concurrently with different consumer IDs if needed.
        run_event_consumer(
            db,
            group="opportunity-engine",
            consumer="worker-1",
            max_events=200,
        )

    try:
        _with_db_session(_job)
    except redis.exceptions.ConnectionError:
        # Redis not running; skip this tick without spamming logs.
        pass


def _run_coin_sync_job() -> None:
    """Synchronize core coin list from CoinGecko. Syncs 40 pages (10000 coins)."""

    def _job(db: Session) -> None:
        import time

        pipeline = CoinSyncPipeline()
        pages = int(__import__("os").getenv("COIN_SYNC_PAGES", "40"))
        for page in range(1, pages + 1):
            try:
                pipeline.run(db, page=page)
                if page < pages:
                    time.sleep(2.0)
            except Exception:
                break

    _with_db_session(_job)


def _run_market_data_job() -> None:
    """
    Refresh market data time series for tracked coins.
    Processes top coins by market cap; limit configurable via MARKET_DATA_LIMIT env.
    """

    def _job(db: Session) -> None:
        import os

        limit = os.getenv("MARKET_DATA_LIMIT")
        pipeline = MarketDataPipeline(limit=int(limit) if limit else None)
        pipeline.run(db)

    _with_db_session(_job)


def _run_description_backfill_job() -> None:
    """
    Backfill descriptions/categories from CoinGecko for coins missing them.
    Processes a bounded batch per tick (default 50) so the scheduler does not
    block for hours. Runs on an interval (default every 60 minutes).
    Set DESCRIPTION_BACKFILL_BATCH=0 to no-op each tick.
    """

    def _job(db: Session) -> None:
        batch = int(os.getenv("DESCRIPTION_BACKFILL_BATCH", "50"))
        if batch <= 0:
            return
        pipeline = DescriptionBackfillPipeline(limit=batch)
        pipeline.run(db)

    _with_db_session(_job)


def _run_news_scraper_job() -> None:
    """Fetch latest crypto news articles from external RSS feeds."""
    _with_db_session(run_news_scraper)


def _run_exchanges_sync_job() -> None:
    """Sync exchange data from CoinGecko."""
    def _job(db: Session) -> None:
        run_exchanges_sync(db)
    _with_db_session(_job)


def _run_signal_bot_dispatcher_job() -> None:
    """Dispatch new signals to active bots (Discord, Telegram, etc.)."""
    _with_db_session(run_signal_bot_dispatcher)


_scheduler_instance: BackgroundScheduler | None = None
_shutdown_requested = False


def get_scheduler() -> BackgroundScheduler | None:
    """Return the running scheduler instance for status API."""
    return _scheduler_instance


def request_shutdown() -> None:
    """Mark that shutdown was requested (so watchdog won't restart)."""
    global _shutdown_requested
    _shutdown_requested = True


def try_restart_scheduler_if_stopped() -> bool:
    """
    If the scheduler exists but stopped unexpectedly (not from shutdown),
    create a new instance and start it. Returns True if a restart was performed.
    """
    global _scheduler_instance
    if _shutdown_requested:
        return False
    s = _scheduler_instance
    if s is None or s.running:
        return False
    logger = logging.getLogger(__name__)
    try:
        logger.warning("Scheduler was stopped unexpectedly; attempting restart")
        try:
            s.shutdown(wait=False)
        except Exception:
            pass
        _scheduler_instance = create_scheduler()
        _scheduler_instance.start()
        return True
    except Exception as e:
        logger.exception("Scheduler restart failed: %s", e)
        return False


def _job_listener(event) -> None:
    """Record job execution success/error for status API."""
    job_id = event.job_id if hasattr(event, "job_id") else getattr(event, "job_id", None)
    if not job_id:
        return
    if event.code == EVENT_JOB_EXECUTED:
        record_job_success(job_id, getattr(event, "retval", None))
    elif event.code == EVENT_JOB_ERROR:
        exc = getattr(event, "exception", None)
        record_job_error(job_id, str(exc) if exc else "Unknown error")


def create_scheduler() -> BackgroundScheduler:
    """
    Create and configure a background scheduler for Block70 agents.

    - Coin sync, market data, description backfill (see env: COIN_SYNC_INTERVAL_MINUTES,
      MARKET_DATA_INTERVAL_MINUTES, DESCRIPTION_BACKFILL_INTERVAL_MINUTES, DESCRIPTION_BACKFILL_BATCH)
    - News scraper, arbitrage, radar, signals, etc.
    """
    global _scheduler_instance
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_listener(_job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    scheduler.add_job(
        _run_arbitrage_job,
        IntervalTrigger(minutes=2),
        id="arbitrage_scan",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_miner_job,
        IntervalTrigger(minutes=30),
        id="miner_scan",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_wallet_job,
        IntervalTrigger(minutes=10),
        id="wallet_scan",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_radar_job,
        IntervalTrigger(minutes=5),
        id="radar_scan",
        replace_existing=True,
        max_instances=1,
    )

    # Alpha snapshot jobs
    scheduler.add_job(
        _run_alpha_hourly_job,
        IntervalTrigger(hours=1),
        id="alpha_snapshot_hourly",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_alpha_daily_job,
        CronTrigger(hour=0, minute=0),
        id="alpha_snapshot_daily",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_backtest_job,
        IntervalTrigger(hours=1),
        id="backtest_scan",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_trade_simulations_job,
        IntervalTrigger(hours=1),
        id="trade_simulations",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_ai_analysis_job,
        IntervalTrigger(minutes=15),
        id="ai_opportunity_analysis",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_daily_briefing_job,
        CronTrigger(hour=0, minute=30),
        id="daily_briefing",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_opportunity_hunter_job,
        IntervalTrigger(minutes=30),
        id="opportunity_hunter",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_liquidity_monitor_job,
        IntervalTrigger(minutes=10),
        id="liquidity_monitor",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_signal_cluster_job,
        IntervalTrigger(minutes=10),
        id="signal_cluster",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_signal_detection_job,
        IntervalTrigger(minutes=5),
        id="signal_detection",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_airdrop_job,
        IntervalTrigger(minutes=30),
        id="airdrop_refresh",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_event_consumer_job,
        IntervalTrigger(seconds=5),
        id="event_consumer",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=15,  # allow runs up to 15s late (e.g. at startup) without logging "missed"
    )

    # Coin + market data jobs
    # coin_sync: refreshes coin list (CoinGecko → CMC → Binance fallbacks in pipeline). COIN_SYNC_PAGES default 40.
    scheduler.add_job(
        _run_coin_sync_job,
        IntervalTrigger(minutes=max(1, int(os.getenv("COIN_SYNC_INTERVAL_MINUTES", "30")))),
        id="coin_sync",
        replace_existing=True,
        max_instances=1,
    )
    # market_data_refresh: price, 24h%, 7d% for top coins. MARKET_DATA_LIMIT caps work per tick.
    scheduler.add_job(
        _run_market_data_job,
        IntervalTrigger(minutes=max(1, int(os.getenv("MARKET_DATA_INTERVAL_MINUTES", "5")))),
        id="market_data_refresh",
        replace_existing=True,
        max_instances=1,
    )
    # description_backfill: batches of DESCRIPTION_BACKFILL_BATCH coins every DESCRIPTION_BACKFILL_INTERVAL_MINUTES
    # (fills gaps in background without blocking the API for hours). Set DESCRIPTION_BACKFILL_BATCH=0 to disable.
    _desc_interval = int(os.getenv("DESCRIPTION_BACKFILL_INTERVAL_MINUTES", "60"))
    _desc_batch = int(os.getenv("DESCRIPTION_BACKFILL_BATCH", "50"))
    if _desc_interval > 0 and _desc_batch > 0:
        scheduler.add_job(
            _run_description_backfill_job,
            IntervalTrigger(minutes=_desc_interval),
            id="description_backfill",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=min(3600, _desc_interval * 60),
        )

    scheduler.add_job(
        _run_news_scraper_job,
        IntervalTrigger(minutes=5),
        id="news_scraper",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_exchanges_sync_job,
        IntervalTrigger(minutes=10),
        id="exchanges_sync",
        replace_existing=True,
        max_instances=1,
    )

    scheduler.add_job(
        _run_signal_bot_dispatcher_job,
        IntervalTrigger(minutes=1),
        id="signal_bot_dispatcher",
        replace_existing=True,
        max_instances=1,
    )

    _scheduler_instance = scheduler
    return scheduler

