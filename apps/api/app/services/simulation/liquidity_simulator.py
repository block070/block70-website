"""
Liquidity curve simulator for estimating slippage and execution feasibility.

Uses a simple impact model: slippage grows with trade size relative to
pool liquidity. Outputs feed into arbitrage validation and scoring.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class LiquiditySimulationResult:
    """Result of simulating a trade against a liquidity pool."""

    estimated_slippage: float  # percent (e.g. 0.5 = 0.5%)
    effective_price: float  # nominal * (1 + slippage/100); 0.0 if no nominal given
    execution_feasibility: float  # 0–1; higher = more feasible


class LiquiditySimulator:
    """
    Estimates slippage and execution feasibility for a hypothetical trade
    given pool liquidity and fee tier.

    Inputs: trade_size (USD), pool_liquidity (USD), fee_percent.
    Outputs: estimated_slippage (%), effective_price, execution_feasibility (0–1).
    """

    # Impact factor: slippage ≈ impact_factor * (trade_size / liquidity) * 100
    # Tuned so ~10% of pool size → ~1–2% slippage band.
    DEFAULT_IMPACT_FACTOR = 15.0

    def __init__(self, impact_factor: Optional[float] = None) -> None:
        self.impact_factor = float(
            impact_factor if impact_factor is not None else self.DEFAULT_IMPACT_FACTOR
        )

    def simulate(
        self,
        trade_size: float,
        pool_liquidity: float,
        fee_percent: float,
        nominal_price: float = 0.0,
    ) -> LiquiditySimulationResult:
        """
        Estimate slippage, effective price, and execution feasibility.

        - trade_size: notional trade size in USD.
        - pool_liquidity: total pool liquidity in USD.
        - fee_percent: pool fee in percent (e.g. 0.25).
        - nominal_price: optional mid price; if > 0, effective_price is computed.

        Slippage is modeled as increasing with trade_size / pool_liquidity.
        Execution feasibility combines liquidity depth, slippage level, and
        trade-size feasibility (smaller trade vs pool = more feasible).
        """
        if pool_liquidity <= 0:
            return LiquiditySimulationResult(
                estimated_slippage=100.0,
                effective_price=0.0,
                execution_feasibility=0.0,
            )

        size_ratio = trade_size / pool_liquidity
        # Cap size_ratio for numerical stability; 100%+ of pool = max slippage.
        size_ratio = min(size_ratio, 1.0)

        # Slippage (percent): impact factor * size ratio, capped at 50%.
        estimated_slippage = min(
            50.0,
            self.impact_factor * size_ratio * 100.0,
        )

        effective_price = 0.0
        if nominal_price > 0:
            effective_price = nominal_price * (1.0 + estimated_slippage / 100.0)

        # Execution feasibility: liquidity depth, slippage, trade size feasibility.
        # Liquidity depth: more liquidity → higher score (saturate around 2M).
        liquidity_depth_score = min(1.0, pool_liquidity / 2_000_000.0)

        # Slippage: lower slippage → higher score (e.g. <1% = 1, >10% = 0).
        slippage_score = max(0.0, 1.0 - estimated_slippage / 10.0)

        # Trade size feasibility: smaller trade relative to pool → higher score.
        # size_ratio 0 → 1, size_ratio 0.2 → 0, above 0.2 → 0.
        size_feasibility = max(0.0, 1.0 - size_ratio * 5.0)

        execution_feasibility = (
            liquidity_depth_score * 0.4
            + slippage_score * 0.4
            + size_feasibility * 0.2
        )
        execution_feasibility = max(0.0, min(1.0, execution_feasibility))

        return LiquiditySimulationResult(
            estimated_slippage=estimated_slippage,
            effective_price=effective_price,
            execution_feasibility=execution_feasibility,
        )
