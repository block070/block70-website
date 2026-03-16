from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.wallet_profile import WalletProfile
from app.schemas.signals import WalletSignal


_executor = ThreadPoolExecutor(max_workers=2)


def _update_wallet_profile(
    wallet_address: str,
    chain: str,
    *,
    realized_pnl_30d_pct: float,
    realized_trades_30d: int,
    win_rate_30d: float,
    amount_usd: float,
    detected_at: datetime,
) -> None:
    """
    Worker function that runs in a background thread and updates the
    WalletProfile row for the given wallet.
    """
    db: Optional[Session] = None
    try:
        db = SessionLocal()

        profile = (
            db.query(WalletProfile)
            .filter(WalletProfile.wallet_address == wallet_address)
            .one_or_none()
        )
        if profile is None:
            profile = WalletProfile(wallet_address=wallet_address, chain=chain)
            db.add(profile)
            db.flush()

        # Treat incoming 30d stats as the latest snapshot rather than a strict
        # incremental update; this avoids double-counting when upstream data
        # is already aggregated over a rolling window.
        total_trades = max(int(realized_trades_30d), 0)
        win_rate = max(min(float(win_rate_30d), 1.0), 0.0)
        average_roi = float(realized_pnl_30d_pct)

        winning_trades = int(round(total_trades * win_rate))
        losing_trades = max(total_trades - winning_trades, 0)

        # Approximate realized profit over the window using the latest
        # notional amount and 30d ROI. This is a heuristic but gives a
        # directionally useful profitability measure.
        profit_delta = amount_usd * (average_roi / 100.0)

        profile.chain = chain or profile.chain
        profile.total_trades = total_trades
        profile.winning_trades = winning_trades
        profile.losing_trades = losing_trades
        profile.win_rate = win_rate
        profile.average_roi = average_roi
        profile.total_profit_usd = (profile.total_profit_usd or 0.0) + profit_delta
        profile.last_activity = detected_at.astimezone(timezone.utc)

        # Keep legacy scoring fields in sync.
        profile.historical_success_rate = win_rate
        profile.avg_roi_percent = average_roi
        profile.total_signals = total_trades
        profile.successful_signals = winning_trades

        db.commit()
    except Exception:
        # Swallow exceptions to avoid impacting the main opportunity pipeline.
        if db is not None:
            db.rollback()
    finally:
        if db is not None:
            db.close()


def schedule_wallet_profile_update_from_signal(signal: WalletSignal) -> None:
    """
    Enqueue an asynchronous WalletProfile update derived from a high-level
    WalletSignal.

    This is intended to be called from wallet signal / opportunity pipelines
    so that performance analytics are kept up to date without slowing down
    the main opportunity processing path.
    """
    _executor.submit(
        _update_wallet_profile,
        signal.wallet_address,
        signal.chain,
        realized_pnl_30d_pct=signal.realized_pnl_30d_pct,
        realized_trades_30d=signal.realized_trades_30d,
        win_rate_30d=signal.win_rate_30d,
        amount_usd=signal.amount_usd,
        detected_at=signal.detected_at,
    )

