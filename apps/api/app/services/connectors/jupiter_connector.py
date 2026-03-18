from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Tuple

import requests

from app.services.connectors.arbitrage_mock_connector import ArbitrageQuote


class JupiterConnector:
    """
    Connector that fetches live swap quotes from the Jupiter API.

    This connector never executes trades. It only fetches price information
    and normalizes it into ArbitrageQuote records, falling back to the
    deterministic mock connector when the API is unavailable.
    """

    BASE_URL = "https://api.jup.ag/swap/v1/quote"

    # Mint addresses on Solana
    USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    SOL_MINT = "So11111111111111111111111111111111111111112"
    BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
    JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
    TAO_MINT = "Cm5QVKLxayZhHY4c5d8HQ8Yus6X8gd2sSz1WkiUeHduo"

    # Pairs are expressed as BASE/USDC – inputMint is base, outputMint is USDC
    DEFAULT_PAIRS: Dict[str, Tuple[str, str]] = {
        "SOL/USDC": (SOL_MINT, USDC_MINT),
        "BONK/USDC": (BONK_MINT, USDC_MINT),
        "JUP/USDC": (JUP_MINT, USDC_MINT),
        "TAO/USDC": (TAO_MINT, USDC_MINT),
    }

    def __init__(self, session: requests.Session | None = None) -> None:
        self._session = session or requests.Session()

    def fetch_quotes(self, pairs: Iterable[str] | None = None) -> List[Dict]:
        """
        Fetch live quotes for the requested pairs.

        Returns a list of plain dicts with the ArbitrageQuote fields:
        - dex
        - pair
        - price
        - liquidity
        - route
        - timestamp

        If the Jupiter API fails, this function returns an empty list; callers
        are expected to handle fallback behavior.
        """
        target_pairs = list(pairs) if pairs is not None else list(self.DEFAULT_PAIRS.keys())
        results: List[Dict] = []

        now = datetime.now(timezone.utc)

        for pair in target_pairs:
            mapping = self.DEFAULT_PAIRS.get(pair)
            if not mapping:
                continue

            input_mint, output_mint = mapping

            try:
                # Use a fixed notional input amount; we only care about a
                # consistent relative price for spread detection.
                params = {
                    "inputMint": input_mint,
                    "outputMint": output_mint,
                    "amount": "1000000",  # arbitrary raw units
                    "slippageBps": "50",
                }
                resp = self._session.get(self.BASE_URL, params=params, timeout=3)
                resp.raise_for_status()
                data = resp.json()
            except Exception:
                continue

            # Jupiter's API may return either a single quote object or a "data" array.
            quote = None
            if isinstance(data, dict):
                if "data" in data and isinstance(data["data"], list) and data["data"]:
                    quote = data["data"][0]
                else:
                    quote = data

            if not isinstance(quote, dict):
                continue

            try:
                in_amount = float(quote.get("inAmount") or quote.get("inputAmount") or 0)
                out_amount = float(quote.get("outAmount") or quote.get("outputAmount") or 0)
            except (TypeError, ValueError):
                in_amount = 0.0
                out_amount = 0.0

            if in_amount <= 0 or out_amount <= 0:
                continue

            # Price in "USDC units per base token" – exact decimal scaling is not
            # critical for relative spread detection as long as it is consistent.
            price = out_amount / in_amount

            # Approximate liquidity in USD from out_amount (USDC has 6 decimals).
            liquidity = out_amount / 1_000_000.0

            route = None
            market_infos = quote.get("marketInfos") or quote.get("routePlan")
            if isinstance(market_infos, list) and market_infos:
                # Best-effort extraction of a human-readable route label.
                labels: List[str] = []
                for mi in market_infos:
                    if not isinstance(mi, dict):
                        continue
                    swap_info = mi.get("swapInfo") if "swapInfo" in mi else mi
                    label = swap_info.get("label") or swap_info.get("ammLabel") or swap_info.get(
                        "marketMeta", {}
                    ).get("label")
                    if label:
                        labels.append(str(label))
                if labels:
                    route = " -> ".join(labels)

            results.append(
                {
                    "dex": "Jupiter",
                    "pair": pair,
                    "price": price,
                    "liquidity": liquidity,
                    "route": route,
                    "timestamp": now,
                }
            )

        # If nothing useful was fetched, the caller can decide to fall back.
        return results


def fetch_live(pairs: Iterable[str] | None = None) -> List[ArbitrageQuote]:
    """
    Convenience helper that fetches live Jupiter quotes only.

    Strict mode: if the Jupiter API is unavailable, return an empty list.
    """
    connector = JupiterConnector()
    live = connector.fetch_quotes(pairs)
    if live:
        return [
            ArbitrageQuote(
                dex=q["dex"],
                pair=q["pair"],
                price=q["price"],
                liquidity=q["liquidity"],
                timestamp=q["timestamp"],
                route=q.get("route"),
            )
            for q in live
        ]

    return []

