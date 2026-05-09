# S&P 500 universe + Alpaca equity bars

This repo keeps a **canonical CSV** of current S&P 500 constituents and scripts to **refresh** it and **backfill** Alpaca OHLC into Timescale **`bars_1m`**.

## Files

| Path | Purpose |
|------|---------|
| [`data/market/sp500/constituents.csv`](../../data/market/sp500/constituents.csv) | Symbol list + metadata (sector, CIK, …) and `as_of_utc` |
| [`scripts/market/fetch_sp500_constituents.py`](../../scripts/market/fetch_sp500_constituents.py) | Regenerate CSV from Wikipedia |
| [`scripts/market/alpaca_bars_ingest.py`](../../scripts/market/alpaca_bars_ingest.py) | Fetch historical bars from Alpaca → `bars_1m` |
| [`scripts/market/sql/bars_1m_unique.sql`](../../scripts/market/sql/bars_1m_unique.sql) | Optional unique index for idempotent upserts |

## Refresh the list

After index rebalances (roughly quarterly), or anytime you want an up-to-date universe:

```bash
cd ~/block70-repo   # or your clone path
python3 scripts/market/fetch_sp500_constituents.py
```

On Ubuntu/Debian, use **`python3`**. There is often no `python` unless you install the **`python-is-python3`** package (`sudo apt install python-is-python3`).

Commit `data/market/sp500/constituents.csv` when it changes.

**Source:** [Wikipedia — List of S&P 500 companies](https://en.wikipedia.org/wiki/List_of_S%26P_500_companies). Verify critical symbols against your broker/data vendor if needed.

## Warehouse prerequisites

Ingest assumes **`bars_1m`** includes:

- `ts` (timestamptz), `asset_class`, `exchange`, `symbol`, `open`, `high`, `low`, `close`, `volume`

Rows are written with **`asset_class = equity`** and **`exchange = ALPACA`** (match existing warehouse conventions).

For **`ON CONFLICT (ts, asset_class, exchange, symbol) DO NOTHING`**, create a matching unique constraint or primary key (see `scripts/market/sql/bars_1m_unique.sql`). If your schema differs, edit the `INSERT` in `alpaca_bars_ingest.py`.

## Run Alpaca backfill (NAS or dev machine)

Set env (same keys as Alpaca’s dashboard; use **paper** vs **live** consistently):

```bash
export MARKET_DATA_DATABASE_URL='postgresql://market:SECRET@127.0.0.1:5433/market'
export APCA_API_KEY_ID='...'
export APCA_API_SECRET_KEY='...'
# Optional: sip requires subscription; iex is common for limited tiers
export ALPACA_DATA_FEED=iex
```

Pick a **UTC date range**. `--end` is an **exclusive** calendar day boundary (script converts to midnight UTC); request one trading day with `--start 2026-05-08 --end 2026-05-09`.

```bash
python3 scripts/market/alpaca_bars_ingest.py \
  --symbols-file data/market/sp500/constituents.csv \
  --start 2026-05-01 \
  --end 2026-05-09 \
  --sleep 0.25
```

Smoke-test without DB writes:

```bash
python3 scripts/market/alpaca_bars_ingest.py --dry-run --start 2026-05-08 --end 2026-05-09 --max-symbols 5
```

**Notes:**

- **Rate limits:** use `--sleep` so ~500 symbols do not burst Alpaca limits.
- **History depth:** max lookback for intraday bars depends on your **Alpaca market data** plan; start with short windows.
- **Feed:** `ALPACA_DATA_FEED=sip` vs `iex` affects coverage; align with your subscription.

## Coverage check (Timescale)

```sql
SELECT symbol, COUNT(*) AS bars, MIN(ts), MAX(ts)
FROM bars_1m
WHERE asset_class = 'equity' AND exchange = 'ALPACA'
GROUP BY symbol
ORDER BY bars ASC
LIMIT 20;
```

Compare symbol count to `SELECT COUNT(DISTINCT symbol) FROM ...` vs ~500 in `constituents.csv`.

## Automation

Point your NAS **cron/systemd** ingest at:

1. Weekly or monthly: `fetch_sp500_constituents.py` (optional git pull + commit from CI).
2. Trading hours / nightly: `alpaca_bars_ingest.py` over a rolling window (e.g. last 2 sessions) for incremental fill.

See also: [`docs/operations/nas-full-dashboard.md`](../operations/nas-full-dashboard.md) (Timescale env, timers).
