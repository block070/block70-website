"""
Portfolio sync engine: fetch wallet balances, update token balances, update total value.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import (
    Portfolio,
    PortfolioWallet,
    PortfolioTokenBalance,
    PortfolioTransaction,
)
from app.services.connectors.portfolio_connector import (
    PortfolioConnector,
    TokenBalanceDto,
    WalletTransactionDto,
)


class PortfolioSyncEngine:
    def __init__(self) -> None:
        self._connector = PortfolioConnector()

    def sync_portfolio(self, db: Session, portfolio_id: int) -> None:
        """
        1. Fetch wallet balances for all wallets in the portfolio.
        2. Update PortfolioTokenBalance records (upsert by portfolio + token_address + chain).
        3. Update total portfolio value.
        """
        portfolio = db.get(Portfolio, portfolio_id)
        if not portfolio:
            return

        wallets = (
            db.query(PortfolioWallet)
            .filter(PortfolioWallet.portfolio_id == portfolio_id)
            .all()
        )
        if not wallets:
            portfolio.total_value_usd = 0.0
            db.add(portfolio)
            db.commit()
            return

        all_balances: list[TokenBalanceDto] = []
        for w in wallets:
            balances = self._connector.fetch_balances(w.wallet_address, w.chain)
            all_balances.extend(balances)

        # Aggregate by (token_symbol, token_address, chain) and sum balance / value
        aggregated: dict[tuple[str, str, str], tuple[float, float]] = {}
        for b in all_balances:
            key = (b.token_symbol, b.token_address, b.chain)
            if key not in aggregated:
                aggregated[key] = (0.0, 0.0)
            agg_bal, agg_val = aggregated[key]
            aggregated[key] = (agg_bal + b.balance, agg_val + b.value_usd)

        # Update or create PortfolioTokenBalance
        existing = {
            (tb.token_symbol, tb.token_address, tb.chain): tb
            for tb in db.query(PortfolioTokenBalance)
            .filter(PortfolioTokenBalance.portfolio_id == portfolio_id)
            .all()
        }
        for (token_symbol, token_address, chain), (balance, value_usd) in aggregated.items():
            row = existing.get((token_symbol, token_address, chain))
            if row:
                row.balance = balance
                row.value_usd = value_usd
                db.add(row)
            else:
                row = PortfolioTokenBalance(
                    portfolio_id=portfolio_id,
                    token_symbol=token_symbol,
                    token_address=token_address,
                    chain=chain,
                    balance=balance,
                    value_usd=value_usd,
                )
                db.add(row)

        total_value = sum(v for _, v in aggregated.values())
        portfolio.total_value_usd = total_value
        db.add(portfolio)
        db.commit()

    def sync_transactions(
        self,
        db: Session,
        portfolio_id: int,
        wallet_address: str,
        chain: str,
        limit: int = 50,
    ) -> list[PortfolioTransaction]:
        """Fetch recent transactions for a wallet and persist as PortfolioTransaction."""
        tx_dtos = self._connector.fetch_transactions(wallet_address, chain, limit=limit)
        created: list[PortfolioTransaction] = []
        for d in tx_dtos:
            existing = (
                db.query(PortfolioTransaction)
                .filter(
                    PortfolioTransaction.portfolio_id == portfolio_id,
                    PortfolioTransaction.tx_hash == d.tx_hash,
                )
                .first()
            )
            if existing:
                continue
            tx = PortfolioTransaction(
                portfolio_id=portfolio_id,
                token_symbol=d.token_symbol,
                transaction_type=d.transaction_type,
                amount=d.amount,
                value_usd=d.value_usd,
                tx_hash=d.tx_hash,
                timestamp=d.timestamp,
            )
            db.add(tx)
            created.append(tx)
        db.commit()
        return created


portfolio_sync_engine = PortfolioSyncEngine()
