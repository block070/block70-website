from datetime import datetime
from typing import List, Dict

from pydantic import BaseModel

from app.services.connectors.arbitrage_mock_connector import ArbitrageQuote
from app.services.simulation.liquidity_simulator import LiquiditySimulator


class ArbitrageSignal(BaseModel):
    """
    Normalized arbitrage signal extracted from raw DEX quotes.
    """

    signal_type: str
    entity_id: str
    value: dict
    confidence: float
    timestamp: datetime


class ArbitrageSignalExtractor:
    """
    Detects arbitrage spreads between DEX prices for the same pair.
    Uses the liquidity simulator to validate opportunities: rejects signals
    where estimated slippage would remove profitability.
    """

    def __init__(
        self,
        min_net_edge_percent: float = 0.8,
        reference_trade_size_usd: float = 100_000.0,
    ) -> None:
        # Minimum (spread_percent - fees_percent) required to emit a signal.
        self.min_net_edge_percent = float(min_net_edge_percent)
        self.reference_trade_size_usd = float(reference_trade_size_usd)
        self._liquidity_simulator = LiquiditySimulator()

    def extract(self, quotes: List[ArbitrageQuote]) -> List[ArbitrageSignal]:
        """
        Given a list of ArbitrageQuote records, detect candidate arbitrage signals.

        For each pair:
        - Consider quotes across Jupiter (aggregated routes), Raydium, and Orca.
        - Find the best bid (highest price) and best ask (lowest price).
        - Compute spread_percent = (best_bid - best_ask) / best_ask * 100.
        - Estimate slippage and fees based on liquidity.
        - Derive a liquidity_score from the lower of the two leg liquidities.
        - Emit a signal only when (spread_percent - estimated_fees_percent) > 0.8%.
        """
        by_pair: Dict[str, List[ArbitrageQuote]] = {}
        for q in quotes:
            by_pair.setdefault(q.pair, []).append(q)

        signals: List[ArbitrageSignal] = []

        for pair, pair_quotes in by_pair.items():
            if len(pair_quotes) < 2:
                continue

            # Identify best ask (cheapest) and best bid (most expensive) for the pair.
            best_ask = min(pair_quotes, key=lambda q: q.price)
            best_bid = max(pair_quotes, key=lambda q: q.price)

            if best_bid.price <= best_ask.price:
                continue

            spread_percent = (best_bid.price - best_ask.price) / best_ask.price * 100.0

            # Liquidity score: normalize min leg liquidity relative to 1M USDC.
            min_liquidity = min(best_ask.liquidity, best_bid.liquidity)
            liquidity_score = max(0.0, min(min_liquidity / 1_000_000.0, 1.0))

            # Fee model: protocol fees + a small routing premium.
            base_fees_percent = 0.30  # baseline for two-leg round trip
            routing_premium_percent = 0.10  # Jupiter / multi-hop overhead
            estimated_fees_percent = base_fees_percent + routing_premium_percent

            # Net edge after accounting for explicit fees (not including slippage).
            net_edge_percent = spread_percent - estimated_fees_percent

            if net_edge_percent <= self.min_net_edge_percent:
                continue

            # Validate with liquidity simulator: reject if slippage removes profitability.
            sim = self._liquidity_simulator.simulate(
                trade_size=self.reference_trade_size_usd,
                pool_liquidity=min_liquidity,
                fee_percent=estimated_fees_percent,
                nominal_price=best_ask.price,
            )
            net_after_slippage = net_edge_percent - sim.estimated_slippage
            if net_after_slippage < 0:
                continue
            if net_after_slippage < self.min_net_edge_percent:
                continue

            # Confidence is higher when net edge is strong and liquidity is deep.
            edge_over_threshold = max(net_edge_percent - self.min_net_edge_percent, 0.0)
            # Normalize over a 5% band beyond the minimum.
            edge_score = max(0.0, min(edge_over_threshold / 5.0, 1.0))
            confidence = 0.6 * edge_score + 0.4 * liquidity_score

            timestamp = max(best_ask.timestamp, best_bid.timestamp)

            signals.append(
                ArbitrageSignal(
                    signal_type="arbitrage_spread",
                    entity_id=f"{pair}:{best_ask.dex}->{best_bid.dex}",
                    value={
                        "pair": pair,
                        "buy_dex": best_ask.dex,
                        "sell_dex": best_bid.dex,
                        "buy_price": best_ask.price,
                        "sell_price": best_bid.price,
                        "spread_percent": spread_percent,
                        "estimated_slippage_percent": sim.estimated_slippage,
                        "estimated_fees_percent": estimated_fees_percent,
                        "liquidity_score": liquidity_score,
                        "min_liquidity_usd": min_liquidity,
                        "execution_feasibility": sim.execution_feasibility,
                        "effective_price": sim.effective_price,
                    },
                    confidence=confidence,
                    timestamp=timestamp,
                )
            )

        return signals

