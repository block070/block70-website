-- Optional: idempotent inserts from scripts/market/alpaca_bars_ingest.py
-- Run on the Timescale `market` database if you do not already have a matching unique constraint.
-- Adjust table/schema name if your warehouse differs.
-- Skip if bars_1m already has PRIMARY KEY or UNIQUE on (ts, asset_class, exchange, symbol).

CREATE UNIQUE INDEX IF NOT EXISTS bars_1m_asset_exchange_symbol_ts_uq
  ON bars_1m (asset_class, exchange, symbol, ts);
