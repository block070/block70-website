# Strategy system review

## Overview

The strategy system supports user-defined **TradingStrategy** rules (entry/exit, conditions), **StrategyCondition** rows for structured filters, **StrategySimulatedTrade** for per-strategy simulated trades, and **StrategyBacktest** for aggregated backtest metrics. The engine evaluates strategies against signals and market data; the backtest and trade simulator use historical price snapshots.

## Performance

- **Strategy engine** (`services/strategy/strategy_engine.py`): Loads signals with a single query (optionally filtered by chain/signal_type); applies conditions in memory. For large signal sets, consider pagination or streaming.
- **Backtest engine**: Aggregates existing `StrategySimulatedTrade` rows for a strategy; O(n) over trades. No heavy DB joins.
- **Trade simulator**: For each entry point, queries `PriceSnapshot` for the token in a time window. Multiple tokens/windows can mean many queries per run; consider batching or caching snapshots by token+time.
- **API**:
  - `GET /api/v1/trading-strategies`: One query for user's strategies.
  - `GET /api/v1/trading-strategies/{id}/backtest?run=true`: Runs backtest then returns result; backtest is fast. Simulation (`POST .../simulate`) can be slower if many entry points and price lookups.
- **Recommendations**: Run simulation and backtest in a background job for large strategies; add rate limiting on run backtest/simulate; index `PriceSnapshot (token_symbol, timestamp)` if not already.

## Data accuracy

- **Entry/exit detection**: Entry points come from signals that satisfy strategy conditions (min_signal_strength, min_confidence, signal_types). Exit points are placeholder (signal_exit) unless extended with price-based TP/SL in the trade simulator.
- **Simulated trades**: Entry price is the nearest `PriceSnapshot` to signal time; exit uses TP/SL/timeout logic in `StrategyTradeSimulator`. Accuracy depends on snapshot frequency and alignment with real fills.
- **Backtest metrics**: Win rate and average profit are derived from `StrategySimulatedTrade.profit_percent`. Max drawdown is computed from cumulative profit; no time-weighted or dollar-weighted adjustment.
- **Recommendations**: Document that simulated trades are hypothetical; consider storing snapshot source and timestamp for audit; add optional slippage/commission in simulator.

## API reliability

- **Auth**: All write and user-scoped read endpoints require `Authorization: Bearer <token>`. Public endpoints: `GET /trading-strategies/share/{id}`, `GET /templates`, `GET /leaderboard`.
- **Errors**: 404 for missing strategy or backtest; 401 for unauthenticated requests. Validation errors return 422.
- **Idempotency**: Creating a strategy is not idempotent. Running backtest/simulate multiple times appends new backtest rows and new simulated trades; consider "replace" semantics or run_id if needed.
- **Recommendations**: Add request IDs for tracing; document rate limits; consider caching leaderboard and public share with short TTL.

## Portfolio strategy integration

- Strategies are user-scoped (`TradingStrategy.user_id`). To "show which strategies affect tokens in user's portfolio": join portfolio token balances (by user) with strategy simulated trades (by strategy and user), e.g. "Tokens in your portfolio that appear in this strategy's trades."
- Implementation: In portfolio or strategy API, for current user get `PortfolioTokenBalance.token_symbol` and `StrategySimulatedTrade.token_symbol` for user's strategies; return overlap with strategy names. Can be a new endpoint e.g. `GET /api/v1/portfolio/strategy-overlap` or a field on strategy detail.

## Alert type: strategy_signal

- `strategy_signal` is included in `GET /api/v1/premium-alerts/types`. To notify users when strategy conditions trigger: in the pipeline that evaluates opportunities/signals, after computing entry points (e.g. `strategy_engine.detect_entry_points`), emit an alert or enqueue a job that creates a `PremiumTriggeredAlert` with metric_type `strategy_signal` and metadata (strategy_id, token_symbol, signal_id). The existing `evaluate_premium_alerts` can be extended to accept strategy triggers or a separate delivery path for strategy_signal.
