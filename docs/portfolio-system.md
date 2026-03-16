# Portfolio system review

## Overview

The portfolio tracker allows users to attach wallets (Ethereum, Solana, Base, Arbitrum), sync balances and transactions, and view value, P/L, token holdings, and insights (e.g. smart money overlap).

## Wallet connectors

- **Location**: `apps/api/app/services/connectors/portfolio_connector.py`
- **Chains**: Ethereum, Solana, Base, Arbitrum (EVM chains share RPC interface; Solana uses JSON-RPC).
- **Behavior**:
  - `fetch_balances(wallet_address, chain)` returns native token balance (SOL, ETH). SPL/ERC-20 token balances require chain-specific token APIs (e.g. Solana token accounts, ERC-20 balanceOf) and are not yet implemented.
  - `fetch_transactions(wallet_address, chain, limit)` returns recent transactions; Solana uses `getSignaturesForAddress`; EVM currently returns empty (requires indexer like Etherscan for full history).
- **Recommendations**: Add token-program support for Solana; add Etherscan/Alchemy for EVM tx history; consider caching RPC responses to reduce rate limits.

## Data accuracy

- **Balances**: Native balances only; `value_usd` is 0 until a price feed is integrated (e.g. CoinGecko in `price_snapshot_connector` or similar).
- **Transactions**: Stored as-is from connector; USD value and token symbol may be placeholder.
- **Total value / P/L**: `total_value_usd` is sum of `PortfolioTokenBalance.value_usd`; `total_profit_loss` is stored but not yet computed from history (no cost-basis tracking).
- **Recommendations**: Integrate price feed for USD valuation; add portfolio value history table for charts and P/L over time; optional cost-basis and realized P/L.

## Performance calculations

- **Location**: `apps/api/app/services/portfolio/portfolio_analytics_engine.py`
- **Metrics**: Total value, total_profit_loss, best/worst performing tokens (by value_usd).
- **Limitation**: “Best/worst” are by current value, not by return; true performance requires historical snapshots or transaction-based cost.
- **Recommendations**: Add periodic portfolio value snapshots; compute 24h/7d change from snapshots; add ROI per token when cost basis is available.

## API performance

- **Endpoints**: `GET /api/v1/portfolio`, `/tokens`, `/transactions`, `POST /add-wallet`, `POST /sync`, `GET /metrics`, `GET /insights/smart-money-overlap`.
- **Auth**: All portfolio endpoints require `Authorization: Bearer <token>`.
- **Sync**: `POST /sync` runs connector for all wallets and can be slow under many wallets or slow RPCs; consider background job and webhook/polling for completion.
- **Recommendations**: Paginate `/transactions`; add caching for `/metrics` with short TTL; move sync to a background task and expose job status.

## Alert types (extended)

- **portfolio_price_change**: Requires portfolio value history and threshold config; not yet evaluated in `premium_alert_engine`.
- **portfolio_whale_overlap**: Can be driven by `smart_money_overlap` service when portfolio tokens match smart wallet activity.
- **portfolio_opportunity**: Can be driven by opportunity engine filtered by user’s held tokens (and optionally signal clusters).

These types are exposed in `GET /api/v1/premium-alerts/types` for subscription creation; evaluation logic can be added in `evaluate_premium_alerts` or a dedicated portfolio alert step.

## Opportunity engine extension

- Portfolio-based opportunities: filter or rank opportunities by tokens held in the user’s portfolio (e.g. from `PortfolioTokenBalance`).
- Smart wallet alignment: boost opportunities where smart wallets are accumulating the same tokens (reuse `smart_money_overlap`).
- Signal clusters: existing radar/signal pipelines can be combined with portfolio tokens to surface “signals related to your holdings.”

Implementation can live in a new service (e.g. `portfolio_opportunity_engine.py`) that consumes portfolio tokens and existing opportunity/signal data.
