from typing import List
import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.middleware.dev_api_usage import DevApiUsageLoggingMiddleware
from sqlalchemy.orm import Session
from starlette.responses import PlainTextResponse

from app.db import Base, engine, get_db
import app.models  # noqa: F401 - ensure all models registered with Base.metadata before create_all
from app.api.v1.opportunities import router as opportunities_router
from app.api.v1.flows import router as flows_router
from app.api.v1.ai_insights import router as ai_insights_router
from app.api.v1.scan import router as scan_router
from app.api.v1.watchlists import router as watchlists_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.insights import router as insights_router
from app.api.v1.wallets import router as wallets_router
from app.api.v1.alpha_feed import router as alpha_feed_router
from app.api.v1.share_cards import router as share_cards_router
from app.api.v1.narratives import router as narratives_router
from app.api.v1.airdrops import router as airdrops_router
from app.api.v1.market import router as market_router
from app.api.v1.alpha import router as alpha_router
from app.api.v1.radar import router as radar_router
from app.api.v1.signals import router as signals_router
from app.api.v1.token_watch import router as token_watch_router
from app.api.v1.backtests import router as backtests_router
from app.api.v1.simulation import router as simulation_router
from app.api.v1.analysis import router as analysis_router
from app.api.v1.briefings import router as briefings_router
from app.api.v1.reports import router as reports_router
from app.api.v1.projects import router as projects_router
from app.api.v1.premium_alerts import router as premium_alerts_router
from app.api.v1.strategies import router as strategies_router
from app.api.v1.events import router as events_router
from app.api.v1.liquidity import router as liquidity_router
from app.api.v1.auth import router as auth_router
from app.api.v1.billing import router as billing_router
from app.api.v1.usage_summary import router as usage_summary_router
from app.api.v1.chains import router as chains_router
from app.api.v1.charts import chart_pack_router, router as charts_router
from app.api.v1.coins import router as coins_router
from app.api.v1.categories import router as categories_router
from app.api.v1.exchanges import router as exchanges_router
from app.api.v1.live import router as live_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.portfolio import router as portfolio_router
from app.api.v1.trading_strategies import router as trading_strategies_router
from app.api.v1.alpha_community import router as alpha_community_router
from app.api.v1.referrals import router as referrals_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.notification_preferences import router as notification_preferences_router
from app.api.v1.me import router as me_router
from app.api.v1.internal_cron import router as internal_cron_router
from app.api.v1.admin_analytics import router as admin_analytics_router
from app.api.v1.admin_exchange_affiliates import router as admin_exchange_affiliates_router
from app.api.v1.exchange_affiliate_public import router as exchange_affiliate_public_router
from app.api.v1.dev_api import router as dev_api_router
from app.api.v1.api_keys import router as api_keys_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.bots import router as bots_router, bots_public_router
from app.api.v1.blocks import router as blocks_router
from app.api.v1.rewards import router as rewards_router
from app.api.v1.leaderboard import router as leaderboard_router
from app.api.v1.copilot import router as copilot_router
from app.api.v1.sentiment import router as sentiment_router
from app.api.v1.token_comments import router as token_comments_router
from app.api.v1.ai_search import router as ai_search_router
from app.api.v1.ai_intelligence import router as ai_intelligence_router
from app.api.v1.news import router as news_router
from app.api.v1.search import router as search_router
from app.api.v1.status import router as status_router, status_public_router
from app.api.articles import router as articles_router
from app.agents.arbitrage_agent import run_arbitrage_scan
from app.jobs.scheduler import create_scheduler
from app.schemas.opportunity_db import OpportunityRead
from app.services.seo.sitemap_generator import generate_sitemap
from app.services.pipeline.coin_sync_pipeline import CoinSyncPipeline


app = FastAPI(title="Block70 API", version="0.1.0")

# In-memory progress for bootstrap/all-coins (poll GET /bootstrap/progress)
_bootstrap_progress: dict = {
    "running": False,
    "step": None,
    "phase": None,
    "current": 0,
    "total": 0,
    "last_slug": None,
    "started_at": None,
    "message": None,
}


def _init_db() -> None:
    """Create tables, run migrations, and seed rewards when database is available."""
    try:
        Base.metadata.create_all(bind=engine)
        from app.db.migrations import run_migrations

        run_migrations()

        from app.db import SessionLocal
        from app.services.rewards.seed_rewards import seed_rewards

        _db = SessionLocal()
        try:
            seed_rewards(_db)
        finally:
            _db.close()
    except Exception:
        # Database may be unavailable (e.g. PostgreSQL not running); app still starts.
        pass


# Defer DB init so app can start even when DB is down; init runs on first use or never.
@app.on_event("startup")
def _on_startup() -> None:
    _init_db()

# CORS configuration - comma-separated origins for block70.com + local
frontend_origins = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(DevApiUsageLoggingMiddleware)

app.include_router(opportunities_router)
app.include_router(flows_router)
app.include_router(ai_insights_router)
app.include_router(scan_router)
app.include_router(watchlists_router)
app.include_router(alerts_router)
app.include_router(insights_router)
app.include_router(wallets_router)
app.include_router(alpha_feed_router)
app.include_router(share_cards_router)
app.include_router(narratives_router)
app.include_router(airdrops_router)
app.include_router(market_router)
app.include_router(alpha_router)
app.include_router(radar_router)
app.include_router(signals_router)
app.include_router(token_watch_router)
app.include_router(backtests_router)
app.include_router(simulation_router)
app.include_router(analysis_router)
app.include_router(briefings_router)
app.include_router(reports_router)
app.include_router(projects_router)
app.include_router(premium_alerts_router)
app.include_router(strategies_router)
app.include_router(events_router)
app.include_router(liquidity_router)
app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(usage_summary_router)
app.include_router(chains_router)
app.include_router(charts_router)
app.include_router(chart_pack_router)
app.include_router(coins_router)
app.include_router(categories_router)
app.include_router(exchanges_router)
app.include_router(live_router)
app.include_router(dashboard_router)
app.include_router(portfolio_router)
app.include_router(trading_strategies_router)
app.include_router(alpha_community_router)
app.include_router(referrals_router)
app.include_router(notifications_router)
app.include_router(notification_preferences_router)
app.include_router(me_router)
app.include_router(internal_cron_router)
app.include_router(admin_analytics_router)
app.include_router(admin_exchange_affiliates_router)
app.include_router(exchange_affiliate_public_router)
app.include_router(dev_api_router)
app.include_router(api_keys_router)
app.include_router(webhooks_router)
app.include_router(bots_router)
app.include_router(bots_public_router)
app.include_router(blocks_router)
app.include_router(rewards_router)
app.include_router(leaderboard_router)
app.include_router(copilot_router)
app.include_router(sentiment_router)
app.include_router(token_comments_router)
app.include_router(ai_search_router)
app.include_router(ai_intelligence_router)
app.include_router(news_router)
app.include_router(search_router)
app.include_router(status_router)
app.include_router(status_public_router)
app.include_router(articles_router)

_scheduler = None


@app.on_event("startup")
def _start_scheduler() -> None:
    global _scheduler
    import logging
    import sys
    import threading
    import time

    def _bootstrap_category_snapshots() -> None:
        time.sleep(2.0)
        try:
            from app.db import SessionLocal
            from app.services.category_snapshot_service import recompute_category_snapshots

            _db = SessionLocal()
            try:
                recompute_category_snapshots(_db)
            finally:
                _db.close()
        except Exception:
            pass

    threading.Thread(target=_bootstrap_category_snapshots, daemon=True).start()

    logger = logging.getLogger(__name__)
    try:
        _scheduler = create_scheduler()
        _scheduler.start()
        logger.info("Scheduler started")
        print("Scheduler started", flush=True)
    except Exception as e:
        logger.exception("Scheduler failed to start: %s", e)
        print(f"Scheduler FAILED: {e}", file=sys.stderr, flush=True)


@app.on_event("shutdown")
def _shutdown_scheduler() -> None:
    from app.jobs.scheduler import request_shutdown

    request_shutdown()
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)


def _health_response() -> dict:
    return {"status": "ok"}


@app.get("/health")
def health_check() -> dict:
    return _health_response()


@app.get("/api/v1/health")
def health_check_v1() -> dict:
    return _health_response()


@app.get("/sitemap.xml", response_class=PlainTextResponse)
def sitemap_xml(db: Session = Depends(get_db)) -> str:
    """SEO sitemap: coins, narratives, news, alpha posts, public strategies."""
    base_url = os.getenv("SITEMAP_BASE_URL", "https://block70.com")
    return generate_sitemap(db, base_url=base_url)


@app.post("/scan/arbitrage", response_model=List[OpportunityRead])
def scan_arbitrage(db: Session = Depends(get_db)) -> List[OpportunityRead]:
    """
    Trigger a one-off arbitrage scan via the ArbitrageAgent and persist
    any resulting opportunities to the database.
    """
    opportunities = run_arbitrage_scan(db)
    return opportunities


@app.post("/bootstrap/coins")
def bootstrap_coins(db: Session = Depends(get_db)) -> dict:
    """
    One-off sync of the Coin table from CoinGecko.
    Fetches multiple pages (default 40 = 10000 coins by market cap).
    Free API may return ~500; Pro API returns full 10000.
    Call this after starting the API with a fresh DB.
    """
    import time
    pages = int(os.getenv("BOOTSTRAP_COINS_PAGES", "40"))
    pipeline = CoinSyncPipeline(per_page=250)
    synced = 0
    for p in range(1, pages + 1):
        try:
            pipeline.run(db, page=p)
            synced += 1
        except Exception:
            break
        if p < pages:
            time.sleep(2.0)
    return {
        "status": "ok",
        "message": f"Coin sync completed ({synced} pages). Coins list will use DB data.",
    }


@app.post("/bootstrap/news")
def bootstrap_news(db: Session = Depends(get_db)) -> dict:
    """
    Manually trigger news ingestion from all configured RSS feeds.
    Use this to fill the site with news on first deploy or to refresh.
    """
    from app.services.scrapers.news_scraper import run_news_scraper

    try:
        run_news_scraper(db)
        return {"status": "ok", "message": "News ingestion completed."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/bootstrap/market-data")
def bootstrap_market_data(db: Session = Depends(get_db)) -> dict:
    """
    One-off refresh of market data (price, 24h%, 7d%, description, links) for all coins.
    Call after bootstrap/coins to populate MarketData and coin metadata.
    Set BOOTSTRAP_MARKET_LIMIT=N to refresh only top N coins (default: all).
    """
    from app.services.pipeline.market_data_pipeline import MarketDataPipeline

    raw = os.getenv("BOOTSTRAP_MARKET_LIMIT", "")
    limit = int(raw) if raw.isdigit() and int(raw) > 0 else None
    pipeline = MarketDataPipeline(limit=limit)
    pipeline.run(db)
    return {"status": "ok", "message": "Market data refreshed for all tracked coins."}


@app.get("/bootstrap/progress")
def bootstrap_progress() -> dict:
    """
    Poll this while POST /bootstrap/all-coins is running to see progress.
    Returns: running, step, phase, current, total, last_slug, started_at, message.
    """
    return dict(_bootstrap_progress)


@app.post("/bootstrap/all-coins")
def bootstrap_all_coins(db: Session = Depends(get_db)) -> dict:
    """
    Update ALL 10,000 coin pages with price, 24h, 7d, market cap, volume, description, category, links.
    Run this to fully populate/refresh every coin. Steps:
    1) Sync 40 pages (10,000 coins) from /coins/markets (price, market cap, volume, 24h/7d change) + insert MarketData
    2) Backfill descriptions, categories, and links for coins missing them (fetches /coins/{id} per coin)
    Takes ~7+ hours due to CoinGecko rate limits (2.5s/coin for 10k). Poll GET /bootstrap/progress to monitor.
    """
    import time
    from datetime import datetime, timezone

    global _bootstrap_progress
    from app.services.pipeline.coin_sync_pipeline import CoinSyncPipeline
    from app.services.pipeline.description_backfill_pipeline import (
        DescriptionBackfillPipeline,
    )

    pages = int(os.getenv("BOOTSTRAP_PAGES", "40"))
    desc_limit = os.getenv("BOOTSTRAP_DESC_LIMIT", "")
    desc_limit_int = int(desc_limit) if desc_limit.isdigit() and int(desc_limit) > 0 else None

    _bootstrap_progress = {
        "running": True,
        "step": "sync",
        "phase": "Coin sync from /coins/markets",
        "current": 0,
        "total": pages,
        "last_slug": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "message": None,
    }

    synced_pages = 0
    desc_stats = {"fetched": 0, "errors": 0}
    pipeline = CoinSyncPipeline(per_page=250)
    try:
        for p in range(1, pages + 1):
            try:
                pipeline.run(db, page=p)
                synced_pages += 1
                _bootstrap_progress["current"] = synced_pages
                _bootstrap_progress["message"] = f"Synced page {p}/{pages}"
            except Exception:
                break
            if p < pages:
                time.sleep(2.0)

        _bootstrap_progress["step"] = "backfill"
        _bootstrap_progress["phase"] = "Description & category backfill"
        _bootstrap_progress["current"] = 0
        _bootstrap_progress["total"] = 0
        _bootstrap_progress["message"] = "Collecting slugs to backfill…"

        def _on_progress(cur: int, total: int, slug: str | None) -> None:
            _bootstrap_progress["current"] = cur
            _bootstrap_progress["total"] = total
            if slug:
                _bootstrap_progress["last_slug"] = slug
            _bootstrap_progress["message"] = f"Backfilled {cur}/{total} coins" if total else str(slug or "")

        desc_pipeline = DescriptionBackfillPipeline(
            limit=desc_limit_int,
            progress_callback=_on_progress,
        )
        desc_stats = desc_pipeline.run(db)

        _bootstrap_progress["message"] = (
            f"Done: {synced_pages} pages synced, {desc_stats['fetched']} descriptions/categories backfilled."
        )
    except Exception as e:
        _bootstrap_progress["message"] = f"Error: {e}"
        raise
    finally:
        _bootstrap_progress["running"] = False

    return {
        "status": "ok",
        "message": f"All coins updated: {synced_pages} pages synced, {desc_stats['fetched']} descriptions backfilled.",
        "synced_pages": synced_pages,
        "description_stats": desc_stats,
    }


@app.post("/bootstrap/exchanges")
def bootstrap_exchanges(db: Session = Depends(get_db)) -> dict:
    """
    One-off sync of exchanges from CoinGecko into the exchanges table.
    Run this after starting the API to populate exchange data for caching/fallback.
    """
    from app.services.exchanges_pipeline import run_exchanges_sync

    try:
        result = run_exchanges_sync(db, limit=100)
        return {"status": "ok", "message": f"Exchanges synced: {result.get('synced', 0)}", "result": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/bootstrap/charts")
def bootstrap_charts() -> dict:
    """
    Backfill chart data for top coins into ChartSnapshot.
    Use Storage → Binance.US → CoinGecko; persists to DB for future requests.
    Run periodically (e.g. cron) to build up chart cache for coins like Monero.
    """
    import time

    from app.services.chart_service import fetch_market_chart

    slugs = [
        "bitcoin", "ethereum", "solana", "binancecoin", "ripple", "cardano",
        "dogecoin", "avalanche-2", "chainlink", "polkadot", "matic-network",
        "uniswap", "cosmos", "monero", "litecoin", "tron", "sui", "near",
    ]
    days_list = ["7", "30"]
    ok, err, total = 0, 0, 0
    for slug in slugs:
        for days_param in days_list:
            try:
                data = fetch_market_chart(slug, days=days_param)
                if data.get("prices"):
                    ok += 1
                total += 1
            except Exception:
                err += 1
            time.sleep(1.5)
    return {"status": "ok", "message": f"Charts backfilled: {ok}/{total} ok, {err} errors."}


@app.post("/bootstrap/descriptions")
def bootstrap_descriptions(db: Session = Depends(get_db)) -> dict:
    """
    Backfill project descriptions and categories for all 10000 coins from CoinGecko.
    Fetches slugs from /coins/markets, then details for coins missing descriptions.
    Throttled (~2.5s/coin); takes ~90 min for full run. Set BOOTSTRAP_DESC_LIMIT=N for testing.
    """
    from app.services.pipeline.description_backfill_pipeline import (
        DescriptionBackfillPipeline,
    )

    raw = os.getenv("BOOTSTRAP_DESC_LIMIT", "")
    limit = int(raw) if raw.isdigit() and int(raw) > 0 else None
    pipeline = DescriptionBackfillPipeline(limit=limit)
    stats = pipeline.run(db)
    return {
        "status": "ok",
        "message": f"Description backfill: {stats['fetched']} fetched, {stats['errors']} errors.",
        "stats": stats,
    }

