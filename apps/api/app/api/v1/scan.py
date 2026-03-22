import os
import time
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
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
    Fetches multiple pages (default 8 = 2000 coins) so pages 6-20 on /coins work.
    Free API may only return first ~500 coins; Pro API returns full 2000.
    """
    pages = int(os.getenv("BOOTSTRAP_COINS_PAGES", "8"))
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

