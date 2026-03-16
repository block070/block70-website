"""
Portfolio analytics engine: total value, profit/loss, best/worst performing tokens.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Portfolio, PortfolioTokenBalance, PortfolioTransaction


class PortfolioAnalyticsEngine:
    def get_metrics(self, db: Session, portfolio_id: int) -> dict[str, Any]:
        """
        Calculate: total value, profit/loss, best performing tokens, worst performing.
        Profit/loss is derived from total_profit_loss on Portfolio; token performance
        would require historical snapshots (placeholder: use current value share).
        """
        portfolio = db.get(Portfolio, portfolio_id)
        if not portfolio:
            return {
                "total_value_usd": 0.0,
                "total_profit_loss": 0.0,
                "best_performing": [],
                "worst_performing": [],
            }

        balances = (
            db.query(PortfolioTokenBalance)
            .filter(PortfolioTokenBalance.portfolio_id == portfolio_id)
            .all()
        )
        total = portfolio.total_value_usd or 0.0
        pl = portfolio.total_profit_loss or 0.0

        # Sort by value_usd for "best"; worst we define as lowest value (or negative change if we had history).
        sorted_by_value = sorted(
            balances,
            key=lambda b: b.value_usd or 0.0,
            reverse=True,
        )
        best = [
            {
                "token_symbol": b.token_symbol,
                "chain": b.chain,
                "value_usd": b.value_usd,
                "balance": b.balance,
            }
            for b in sorted_by_value[:5]
        ]
        worst = [
            {
                "token_symbol": b.token_symbol,
                "chain": b.chain,
                "value_usd": b.value_usd,
                "balance": b.balance,
            }
            for b in (sorted_by_value[-5:] if len(sorted_by_value) > 5 else sorted_by_value)
        ]
        worst.reverse()

        return {
            "total_value_usd": total,
            "total_profit_loss": pl,
            "best_performing": best,
            "worst_performing": worst,
        }


portfolio_analytics_engine = PortfolioAnalyticsEngine()
