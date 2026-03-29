-- Strategy backtest equity columns, signal bot -> strategy FK, OHLCV scaffold.
-- Run against your Postgres DB after backup.

ALTER TABLE strategy_backtests
  ADD COLUMN IF NOT EXISTS total_return_pct double precision NOT NULL DEFAULT 0;
ALTER TABLE strategy_backtests
  ADD COLUMN IF NOT EXISTS equity_curve_json text NULL;

ALTER TABLE signal_bots
  ADD COLUMN IF NOT EXISTS strategy_id integer NULL
  REFERENCES trading_strategies (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_signal_bots_strategy_id ON signal_bots (strategy_id);

CREATE TABLE IF NOT EXISTS ohlcv_candles (
  id serial PRIMARY KEY,
  symbol varchar(64) NOT NULL,
  timeframe varchar(16) NOT NULL,
  ts_open timestamptz NOT NULL,
  open double precision NOT NULL,
  high double precision NOT NULL,
  low double precision NOT NULL,
  close double precision NOT NULL,
  volume double precision NOT NULL DEFAULT 0,
  chain varchar(32) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ohlcv_symbol_timeframe_ts UNIQUE (symbol, timeframe, ts_open)
);
CREATE INDEX IF NOT EXISTS ix_ohlcv_candles_symbol ON ohlcv_candles (symbol);
CREATE INDEX IF NOT EXISTS ix_ohlcv_candles_tf_ts ON ohlcv_candles (timeframe, ts_open);
