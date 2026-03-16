from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from app.models import SimulatedTrade


@dataclass
class PortfolioPerformanceResult:
    """
    Aggregated performance metrics for a collection of simulated trades.
    """

    total_return: float           # total profit in USD
    win_rate: float               # fraction of trades with profit > 0 (0–1)
    average_trade_roi: float      # average profit_percent across trades
    max_drawdown: float           # max peak-to-trough drawdown as a percent (0–100)


class PortfolioPerformanceEngine:
    """
    Engine for aggregating SimulatedTrade rows into portfolio-level
    performance metrics.
    """

    def compute_performance(
        self,
        trades: Sequence[SimulatedTrade] | Iterable[SimulatedTrade],
        *,
        starting_balance: float,
    ) -> PortfolioPerformanceResult:
        """
        Compute aggregate performance metrics from a set of simulated trades.

        Metrics:
        - total_return: sum of trade.profit_usd
        - win_rate: share of trades where profit_percent > 0
        - average_trade_roi: mean of profit_percent across all trades
        - max_drawdown: worst peak-to-trough equity drawdown (in percent)

        Drawdown is computed on a simple equity curve, assuming trades are
        applied sequentially in order of exit_timestamp.
        """
        trades_list = list(trades)
        if not trades_list:
            return PortfolioPerformanceResult(
                total_return=0.0,
                win_rate=0.0,
                average_trade_roi=0.0,
                max_drawdown=0.0,
            )

        total_profit_usd = 0.0
        wins = 0
        rois: list[float] = []

        for t in trades_list:
            total_profit_usd += float(t.profit_usd)
            if float(t.profit_percent) > 0.0:
                wins += 1
            rois.append(float(t.profit_percent))

        trade_count = len(trades_list)
        win_rate = wins / trade_count if trade_count > 0 else 0.0
        avg_roi = sum(rois) / trade_count if trade_count > 0 else 0.0

        max_dd_pct = self._compute_max_drawdown_percent(
            trades_list,
            starting_balance=starting_balance,
        )

        return PortfolioPerformanceResult(
            total_return=total_profit_usd,
            win_rate=win_rate,
            average_trade_roi=avg_roi,
            max_drawdown=max_dd_pct,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _compute_max_drawdown_percent(
        trades: Sequence[SimulatedTrade],
        *,
        starting_balance: float,
    ) -> float:
        """
        Compute maximum drawdown as a percentage using a simple equity curve:

        - Start from starting_balance.
        - Apply each trade's profit_usd in order of exit_timestamp.
        - Track running equity, peak equity, and worst peak-to-trough
          percentage drop.
        """
        if starting_balance <= 0:
            return 0.0

        ordered = sorted(trades, key=lambda t: t.exit_timestamp)

        equity = float(starting_balance)
        peak = equity
        max_drawdown_pct = 0.0

        for t in ordered:
            equity += float(t.profit_usd)
            if equity > peak:
                peak = equity
                continue

            if peak > 0:
                drawdown_pct = (peak - equity) / peak * 100.0
                if drawdown_pct > max_drawdown_pct:
                    max_drawdown_pct = drawdown_pct

        return max_drawdown_pct

