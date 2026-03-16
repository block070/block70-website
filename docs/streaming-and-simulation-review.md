# Streaming + Simulation System Review

## Event streaming reliability

- **Publish path**: `publish_event()` persists a `StreamEvent` to the database first, then pushes to Redis with a try/except. If Redis is down, the event is still stored so it can be replayed or polled from the DB. This avoids losing events when Redis is unavailable.
- **Consumer groups**: The consumer uses a Redis Stream consumer group (`opportunity-engine`, `worker-1`). Multiple workers can share the group; Redis distributes messages.
- **Acknowledgment**: Processed messages are now acknowledged via `ack_events()` so Redis does not redeliver them and the PEL (pending list) does not grow unbounded.
- **Recommendation**: For replay from DB, consider a small job that reads unprocessed `StreamEvent` rows (e.g. with a `consumed_at` column) and re-publishes to Redis if needed.

## Connector event publishing

- **Price snapshot connector**: Calls `publish_event()` after each snapshot; events are emitted when price data is collected and persisted.
- **Wallet mock connector**: Publishes `wallet_transaction` events only when the caller passes a DB session (`fetch_events(db)`). The wallet agent and other callers should pass `db` if streaming is desired.
- **Arbitrage mock connector**: Same pattern; publishes `dex_trade` only when `fetch_quotes(db)` is called with a session. The opportunity pipeline and scan endpoints should pass `db` when calling the connector so that stream events are produced.

**Recommendation**: Ensure `run_arbitrage_scan` and any code path that fetches quotes or wallet events passes the DB session into the connector so that stream events are published.

## Consumer performance

- **Scheduler**: The event consumer job runs every 5 seconds with `max_events=200` and processes in a single batch per run. It does not block the FastAPI server because it runs in the APScheduler background thread.
- **Processing**: Routing and signal extraction are in-process; the only I/O is DB and (for consume) Redis. For high throughput, consider multiple consumer processes with the same group name.
- **Ack**: After processing, the consumer acks all consumed message IDs so Redis can trim the PEL and avoid redelivery.

## Liquidity simulation accuracy

- **Model**: `LiquiditySimulator` uses a simple impact model: `slippage ≈ impact_factor * (trade_size / pool_liquidity) * 100`, with a 50% cap. This is a linear approximation; real AMMs have curved impact.
- **Execution feasibility**: Combines liquidity depth (pool size vs 2M), slippage level (lower is better), and trade-size feasibility (size ratio vs pool). Weights are 40% / 40% / 20%.
- **Use**: The arbitrage signal extractor uses the simulator to reject opportunities where estimated slippage would remove profitability and to attach `execution_feasibility` and `estimated_slippage_percent` to signals. The scoring engine uses `execution_feasibility_score` in the total score.

**Recommendation**: For production, consider calibrating `impact_factor` (and optionally the feasibility weights) against historical fill data or a more detailed AMM curve (e.g. constant-product).

## Integration with Opportunity Engine

- **Event consumer**: For `dex_trade` and `liquidity_change` events, the consumer rebuilds `ArbitrageQuote` from the payload, runs `ArbitrageSignalExtractor`, and forwards signals to `_forward_arbitrage_signals_to_engine`, which normalizes, scores, deduplicates, and persists opportunities and alpha events. Full integration is in place for arbitrage.
- **Wallet / social / GitHub**: Events are parsed and extracted, but `_forward_wallet_signals_to_engine`, `_forward_social_signals_to_engine`, and `_forward_github_signals_to_engine` are stubs (no-op). Extending them would connect streamed wallet/social/dev activity to new opportunities.

## Integration with Radar system

- **Liquidity monitor**: Emits `RadarSignal` rows with types `liquidity_increase`, `liquidity_drop`, `volume_spike` when pool liquidity or volume changes exceed thresholds. These are persisted to the same `radar_signals` table used by the radar pipeline.
- **Radar pipeline**: `RadarEventEngine.aggregate()` loads all `RadarSignal` rows (optionally filtered by `since`). It groups by `token_symbol` and computes `event_score` from signal count, strength, confidence, and recency. No filter on `signal_type`, so liquidity signals are included automatically in radar events and in any downstream opportunity generation that uses radar.

## System stability and performance

- **Failure isolation**: Connectors that publish events do not raise when Redis fails; only the DB write is required. The consumer catches parse errors per event and continues. Signal forwarders that commit (e.g. arbitrage) commit only their own work.
- **Backpressure**: Redis stream has `maxlen=10000` (approximate); old messages are trimmed. Consumer processes up to `max_events` per run, so latency depends on run interval and processing time.
- **Resource use**: One Redis connection (lazy), one DB session per consumer run. No long-lived connections in the consumer loop.

**Recommendations**:
1. Ensure agents that should produce stream events (arbitrage, wallet) pass the DB session into the connectors.
2. Optionally add a health or metrics endpoint that reports Redis connectivity and stream length.
3. Keep the liquidity simulator’s impact factor and thresholds under review as real execution data becomes available.
