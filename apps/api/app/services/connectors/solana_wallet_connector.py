from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List, Optional

import requests
from pydantic import BaseModel


class WalletActivityEvent(BaseModel):
    """
    Structured wallet activity event derived from Solana transactions.
    """

    wallet_address: str
    token_symbol: str
    transaction_type: str  # e.g. "buy", "sell", "accumulate"
    amount: float
    usd_value: float
    timestamp: datetime


class SolanaWalletConnector:
    """
    Connector that fetches recent on-chain activity for monitored wallets
    using a Solana JSON-RPC endpoint.

    This connector never executes trades; it only reads transaction data.
    """

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        monitored_wallets: Optional[List[str]] = None,
    ) -> None:
        self.rpc_url = rpc_url or os.getenv(
            "SOLANA_RPC_URL",
            "https://api.mainnet-beta.solana.com",
        )
        if monitored_wallets is not None:
            self.wallets = monitored_wallets
        else:
            raw = os.getenv("MONITORED_WALLETS", "")
            self.wallets = [w.strip() for w in raw.split(",") if w.strip()]

        self._session = requests.Session()

    def fetch_events(self, limit_per_wallet: int = 10) -> List[WalletActivityEvent]:
        """
        Fetch recent transactions for all monitored wallets and derive simple
        wallet activity events.
        """
        if not self.wallets:
            return []

        events: List[WalletActivityEvent] = []

        for wallet in self.wallets:
            signatures = self._get_signatures_for_address(wallet, limit_per_wallet)
            for sig_info in signatures:
                signature = sig_info.get("signature")
                if not signature:
                    continue

                tx = self._get_transaction(signature)
                if not tx:
                    continue

                ev = self._derive_event_from_transaction(wallet, tx)
                if ev:
                    events.append(ev)

        return events

    def _post_rpc(self, method: str, params: list) -> Optional[dict]:
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
                "params": params,
            }
            resp = self._session.post(self.rpc_url, json=payload, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            return data.get("result")
        except Exception:
            return None

    def _get_signatures_for_address(self, address: str, limit: int) -> List[dict]:
        result = self._post_rpc(
            "getSignaturesForAddress",
            [address, {"limit": limit, "commitment": "confirmed"}],
        )
        if not isinstance(result, list):
            return []
        return result

    def _get_transaction(self, signature: str) -> Optional[dict]:
        result = self._post_rpc(
            "getTransaction",
            [signature, {"encoding": "jsonParsed", "commitment": "confirmed"}],
        )
        if not isinstance(result, dict):
            return None
        return result

    def _derive_event_from_transaction(
        self,
        wallet: str,
        tx: dict,
    ) -> Optional[WalletActivityEvent]:
        meta = tx.get("meta") or {}
        transaction = tx.get("transaction") or {}

        # Use native SOL balance delta as a simple proxy for activity.
        account_keys = (transaction.get("message") or {}).get("accountKeys") or []
        try:
            index = [k.get("pubkey") if isinstance(k, dict) else k for k in account_keys].index(
                wallet
            )
        except ValueError:
            return None

        pre_balances = meta.get("preBalances") or []
        post_balances = meta.get("postBalances") or []
        if index >= len(pre_balances) or index >= len(post_balances):
            return None

        pre = pre_balances[index]
        post = post_balances[index]
        try:
            delta_lamports = int(post) - int(pre)
        except (TypeError, ValueError):
            return None

        if delta_lamports == 0:
            return None

        amount_sol = abs(delta_lamports) / 1_000_000_000.0

        if amount_sol <= 0:
            return None

        transaction_type = "buy" if delta_lamports < 0 else "sell"
        token_symbol = "SOL"

        # USD valuation would require an external price source; use 0 for now.
        usd_value = 0.0

        block_time = tx.get("blockTime")
        if isinstance(block_time, (int, float)):
            timestamp = datetime.fromtimestamp(block_time, tz=timezone.utc)
        else:
            timestamp = datetime.now(timezone.utc)

        return WalletActivityEvent(
            wallet_address=wallet,
            token_symbol=token_symbol,
            transaction_type=transaction_type,
            amount=amount_sol,
            usd_value=usd_value,
            timestamp=timestamp,
        )

