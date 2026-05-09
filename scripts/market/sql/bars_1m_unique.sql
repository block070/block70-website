-- Optional: idempotent inserts using ON CONFLICT from alpaca_bars_ingest.py --on-conflict
--
-- TimescaleDB: CREATE UNIQUE INDEX is NOT supported on hypertables that have compression
-- enabled. If you see that error, skip this file and run ingest without --on-conflict
-- (default: INSERT ... WHERE NOT EXISTS duplicate check).
--
-- If bars_1m already has an equivalent PRIMARY KEY or UNIQUE, you do not need this.

CREATE UNIQUE INDEX IF NOT EXISTS bars_1m_asset_exchange_symbol_ts_uq
  ON bars_1m (asset_class, exchange, symbol, ts);
