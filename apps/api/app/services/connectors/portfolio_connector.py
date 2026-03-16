"""
Blockchain connector for portfolio: fetch wallet balances and transactions.

Supports: Ethereum, Solana, Base, Arbitrum.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

import requests


@dataclass
class TokenBalanceDto:
    token_symbol: str
    token_address: str
    chain: str
    balance: float
    value_usd: float


@dataclass
class WalletTransactionDto:
    token_symbol: str
    transaction_type: str  # buy, sell, transfer_in, transfer_out
    amount: float
    value_usd: float
    tx_hash: str
    timestamp: datetime


SUPPORTED_CHAINS = ("ethereum", "solana", "base", "arbitrum")

# EVM chains share the same RPC interface; only the URL differs.
EVM_CHAINS = ("ethereum", "base", "arbitrum")

RPC_URLS = {
    "ethereum": os.getenv("ETHEREUM_RPC_URL", "https://eth.llamarpc.com"),
    "solana": os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"),
    "base": os.getenv("BASE_RPC_URL", "https://mainnet.base.org"),
    "arbitrum": os.getenv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
}


class PortfolioConnector:
    """
    Fetch wallet balances and transactions across Ethereum, Solana, Base, Arbitrum.
    """

    def __init__(self) -> None:
        self._session = requests.Session()

    def fetch_balances(
        self,
        wallet_address: str,
        chain: str,
    ) -> List[TokenBalanceDto]:
        """Fetch token balances for a wallet on the given chain."""
        chain_lower = chain.lower()
        if chain_lower not in SUPPORTED_CHAINS:
            return []
        if chain_lower == "solana":
            return self._fetch_solana_balances(wallet_address)
        if chain_lower in EVM_CHAINS:
            return self._fetch_evm_balances(wallet_address, chain_lower)
        return []

    def fetch_transactions(
        self,
        wallet_address: str,
        chain: str,
        limit: int = 50,
    ) -> List[WalletTransactionDto]:
        """Fetch recent transactions for a wallet on the given chain."""
        chain_lower = chain.lower()
        if chain_lower not in SUPPORTED_CHAINS:
            return []
        if chain_lower == "solana":
            return self._fetch_solana_transactions(wallet_address, limit)
        if chain_lower in EVM_CHAINS:
            return self._fetch_evm_transactions(wallet_address, chain_lower, limit)
        return []

    def _post_rpc(self, url: str, method: str, params: list) -> Optional[dict]:
        try:
            payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
            resp = self._session.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return data.get("result")
        except Exception:
            return None

    def _fetch_solana_balances(self, wallet_address: str) -> List[TokenBalanceDto]:
        url = RPC_URLS["solana"]
        result = self._post_rpc(
            url,
            "getBalance",
            [wallet_address],
        )
        if result is None:
            return []
        lamports = result.get("value", 0) or 0
        balance_sol = lamports / 1_000_000_000.0
        # USD would come from a price feed; placeholder.
        return [
            TokenBalanceDto(
                token_symbol="SOL",
                token_address="So11111111111111111111111111111111111111112",
                chain="solana",
                balance=balance_sol,
                value_usd=0.0,
            )
        ]

    def _fetch_evm_balances(self, wallet_address: str, chain: str) -> List[TokenBalanceDto]:
        url = RPC_URLS.get(chain)
        if not url:
            return []
        result = self._post_rpc(url, "eth_getBalance", [wallet_address, "latest"])
        if result is None:
            return []
        try:
            wei = int(result, 16)
        except (TypeError, ValueError):
            return []
        balance_eth = wei / 1e18
        native_symbol = "ETH" if chain == "ethereum" else "ETH"
        return [
            TokenBalanceDto(
                token_symbol=native_symbol,
                token_address="0x0000000000000000000000000000000000000000",
                chain=chain,
                balance=balance_eth,
                value_usd=0.0,
            )
        ]

    def _fetch_solana_transactions(
        self,
        wallet_address: str,
        limit: int,
    ) -> List[WalletTransactionDto]:
        url = RPC_URLS["solana"]
        result = self._post_rpc(
            url,
            "getSignaturesForAddress",
            [wallet_address, {"limit": limit, "commitment": "confirmed"}],
        )
        if not isinstance(result, list):
            return []
        out: List[WalletTransactionDto] = []
        for i, item in enumerate(result[:limit]):
            sig = item.get("signature") or ""
            block_time = item.get("blockTime")
            if isinstance(block_time, (int, float)):
                ts = datetime.fromtimestamp(block_time, tz=timezone.utc)
            else:
                ts = datetime.utcnow()
            out.append(
                WalletTransactionDto(
                    token_symbol="SOL",
                    transaction_type="transfer",
                    amount=0.0,
                    value_usd=0.0,
                    tx_hash=sig,
                    timestamp=ts,
                )
            )
        return out

    def _fetch_evm_transactions(
        self,
        wallet_address: str,
        chain: str,
        limit: int,
    ) -> List[WalletTransactionDto]:
        # Full tx history typically requires an indexer (Etherscan, etc.).
        # Return empty for now; sync engine can be extended with indexer API.
        return []
