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

**PEP 668 (Ubuntu 24.04+):** `pip install --user` may be blocked. Prefer **`apt`** packages for the fetch script:

```bash
sudo apt install -y python3-requests python3-bs4
```

For `alpaca_bars_ingest.py`, add **`python3-psycopg2`**. Alternatively use a **venv** (`python3 -m venv .venv && source .venv/bin/activate && pip install …`).

Commit `data/market/sp500/constituents.csv` when it changes.

**Source:** [Wikipedia — List of S&P 500 companies](https://en.wikipedia.org/wiki/List_of_S%26P_500_companies). Verify critical symbols against your broker/data vendor if needed.

## Warehouse prerequisites

Ingest assumes **`bars_1m`** includes:

- `ts` (timestamptz), `asset_class`, `exchange`, `symbol`, `open`, `high`, `low`, `close`, `volume`
- **`source` (text, NOT NULL)** — set via **`--source`** or **`MARKET_BARS_SOURCE`** (script default **`alpaca`**). Match whatever your crypto rows use if you standardize labels.

Rows are written with **`asset_class = equity`** and **`exchange = ALPACA`** (match existing warehouse conventions).

By default the ingest script uses **`INSERT ... WHERE NOT EXISTS`** so you **do not** need a unique index. That avoids Timescale errors when **`bars_1m`** has **compression** enabled (`CREATE UNIQUE INDEX` is not allowed on compressed hypertables in many setups).

Optional faster path: add a unique constraint on `(ts, asset_class, exchange, symbol)` and run ingest with **`--on-conflict`** (uses **`ON CONFLICT DO NOTHING`**). See `scripts/market/sql/bars_1m_unique.sql` — skip it if compression blocks index creation.

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

For **long history**, use **`--chunk-days`** so each Alpaca request window stays smaller (recommended with ~500 symbols):

```bash
python3 scripts/market/alpaca_bars_ingest.py \
  --symbols-file data/market/sp500/constituents.csv \
  --start 2026-04-01 \
  --end 2026-05-10 \
  --chunk-days 7 \
  --sleep 0.25
```

Dependencies on Ubuntu (system Python): **`sudo apt install -y python3-requests python3-psycopg2`** (`requests` may already be installed).

Smoke-test without DB writes:

```bash
python3 scripts/market/alpaca_bars_ingest.py --dry-run --start 2026-05-08 --end 2026-05-09 --max-symbols 5
```

**Notes:**

- **401 Unauthorized:** Wrong or mismatched Alpaca keys — copy **API Key ID** and **Secret Key** from the Alpaca dashboard (**Paper** vs **Live** use **different** keys). Do not use placeholder `...` in `export`.
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
