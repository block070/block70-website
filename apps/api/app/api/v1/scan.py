import os
import time
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Coin
from app.agents.arbitrage_agent import run_arbitrage_scan
from app.agents.miner_agent import run_miner_scan
from app.agents.wallet_agent import run_wallet_scan
from app.schemas.opportunity_db import OpportunityRead
from app.services.pipeline.coin_sync_pipeline import CoinSyncPipeline


router = APIRouter(prefix="/api/v1/scan", tags=["scan"])


@router.post("/arbitrage", response_model=List[OpportunityRead])
def scan_arbitrage(db: Session = Depends(get_db)) -> List[OpportunityRead]:
    """
    Manually trigger an arbitrage scan via the ArbitrageAgent and return
    the opportunities detected during this run.
    """
    return run_arbitrage_scan(db)


@router.post("/miners", response_model=List[OpportunityRead])
def scan_miners(db: Session = Depends(get_db)) -> List[OpportunityRead]:
    """
    Manually trigger a miner ROI scan via the MinerAgent and return
    the opportunities detected during this run.
    """
    return run_miner_scan(db)


@router.post("/wallets", response_model=List[OpportunityRead])
def scan_wallets(db: Session = Depends(get_db)) -> List[OpportunityRead]:
    """
    Manually trigger a wallet activity scan via the WalletAgent and return
    the opportunities detected during this run.
    """
    return run_wallet_scan(db)


@router.post("/bootstrap/coins")
def bootstrap_coins(db: Session = Depends(get_db)) -> dict:
    """
    One-off sync of the Coin table from CoinGecko.
    Fetches multiple pages (default 40 = 10000 coins) by market cap.
    Free API may return ~500; Pro API returns full 10000.
    """
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
        "message": f"Coin sync completed ({synced} pages).",
    }


@router.post("/backfill/categories")
def backfill_categories(
    batch: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict:
    """
    Fill category + category_slug from CoinGecko /coins/{id} for rows missing slug.
    Run repeatedly until updated=0 to cover ~10k coins (rate-limited).
    """
    from app.services.connectors.coingecko_connector import fetch_coin_details

    from app.api.v1.coins import _coingecko_throttle

    rows = (
        db.query(Coin)
        .filter(or_(Coin.category_slug.is_(None), Coin.category_slug == ""))
        .order_by(Coin.market_cap_rank.asc().nullslast(), Coin.id.asc())
        .limit(batch)
        .all()
    )
    updated = 0
    for coin in rows:
        try:
            _coingecko_throttle()
            payload = fetch_coin_details(coin.slug, vs_currency="usd")
            c = payload.get("coin") or {}
            if c.get("category"):
                coin.category = c.get("category")
            if c.get("category_slug"):
                coin.category_slug = c.get("category_slug")
                updated += 1
        except Exception:
            continue
    try:
        db.commit()
    except Exception:
        db.rollback()
    return {"updated": updated, "processed": len(rows)}

