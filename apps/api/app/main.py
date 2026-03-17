from typing import List
import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
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
from app.api.v1.coins import router as coins_router
from app.api.v1.live import router as live_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.portfolio import router as portfolio_router
from app.api.v1.trading_strategies import router as trading_strategies_router
from app.api.v1.alpha_community import router as alpha_community_router
from app.api.v1.referrals import router as referrals_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.admin_analytics import router as admin_analytics_router
from app.api.v1.dev_api import router as dev_api_router
from app.api.v1.api_keys import router as api_keys_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.bots import router as bots_router
from app.api.v1.blocks import router as blocks_router
from app.api.v1.rewards import router as rewards_router
from app.api.v1.leaderboard import router as leaderboard_router
from app.api.v1.copilot import router as copilot_router
from app.api.v1.sentiment import router as sentiment_router
from app.api.v1.token_comments import router as token_comments_router
from app.api.v1.ai_search import router as ai_search_router
from app.api.articles import router as articles_router
from app.agents.arbitrage_agent import run_arbitrage_scan
from app.jobs.scheduler import create_scheduler
from app.schemas.opportunity_db import OpportunityRead
from app.services.seo.sitemap_generator import generate_sitemap
from app.services.pipeline.coin_sync_pipeline import CoinSyncPipeline


app = FastAPI(title="Block70 API", version="0.1.0")


def _init_db() -> None:
    """Create tables and seed rewards when database is available."""
    try:
        Base.metadata.create_all(bind=engine)
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

# CORS configuration for local frontend
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_origin],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(coins_router)
app.include_router(live_router)
app.include_router(dashboard_router)
app.include_router(portfolio_router)
app.include_router(trading_strategies_router)
app.include_router(alpha_community_router)
app.include_router(referrals_router)
app.include_router(notifications_router)
app.include_router(admin_analytics_router)
app.include_router(dev_api_router)
app.include_router(api_keys_router)
app.include_router(webhooks_router)
app.include_router(bots_router)
app.include_router(blocks_router)
app.include_router(rewards_router)
app.include_router(leaderboard_router)
app.include_router(copilot_router)
app.include_router(sentiment_router)
app.include_router(token_comments_router)
app.include_router(ai_search_router)
app.include_router(articles_router)

_scheduler = create_scheduler()


@app.on_event("startup")
def _start_scheduler() -> None:
    # Run agent jobs in a background scheduler so they do not block
    # the API server's request handlers.
    if not _scheduler.running:
        _scheduler.start()


@app.on_event("shutdown")
def _shutdown_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


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
    One-off sync of the Coin table from CoinGecko (first page of majors).
    Call this after starting the API with a fresh DB to get real coins so
    the Coins page and coin detail pages (e.g. /coins/solana) use API data.
    """
    pipeline = CoinSyncPipeline(per_page=250)
    pipeline.run(db, page=1)
    return {"status": "ok", "message": "Coin sync completed. Coins list and detail pages will now use API data."}

