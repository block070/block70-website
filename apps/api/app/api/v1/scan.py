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
    One-off sync of the Coin table from CoinGecko (first page of majors).
    Call this after starting the API with a fresh DB so the Coins page and
    coin detail pages use API data.
    """
    pipeline = CoinSyncPipeline(per_page=250)
    pipeline.run(db, page=1)
    return {"status": "ok", "message": "Coin sync completed."}

