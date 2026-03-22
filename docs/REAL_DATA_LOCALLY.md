# Getting Real Data (No Deployment Required)

You do **not** need to deploy the website for real data. Real data works as soon as the **database is running** and the **API** is connected to it. The frontend already uses the API; when the API returns data from the database, the site shows real information.

---

## What “real” means here

| Data | Source | How it gets into the DB |
|------|--------|-------------------------|
| **Coins** (list + detail e.g. SOL) | CoinGecko API | Coin sync pipeline (scheduler every 30 min, or one-off bootstrap) |
| **Opportunities** | Arbitrage pipeline (mock or live connector) | Scheduler every 2 min, or `POST /scan/arbitrage` |
| **Signals** | Connectors + extractors | Scheduler jobs + event consumer |
| **Alpha / briefings** | Ranking + briefing engine | Scheduler (hourly/daily) |
| **News** | RSS scrapers | Scheduler every 10 min |
| **AI insights** | AI insight engine | Scheduler or `POST /api/v1/ai/insights/seed-examples` |

The **mock data** in the frontend (e.g. coins list fallback, coin detail fallback for SOL) is only used when the API returns **no data** or 404. Once the DB is populated, the API returns real data and the UI uses it.

---

## Quick start – bring up the website

From the repo root (`c:\block70`):

1. **Start everything (Docker)**  
   ```powershell
   docker-compose up -d postgres redis
   docker-compose up api web
   ```  
   Leave this running. API will be at **http://localhost:8000**, website at **http://localhost:3000**.

2. **Verify API + data (optional)**  
   In another terminal:  
   ```powershell
   .\scripts\verify-api-data.ps1
   ```  
   This checks health, bootstraps coins from CoinGecko, and confirms coins/opportunities/insights.

3. **Open the site**  
   In your browser: **http://localhost:3000**

**Without Docker (API + web on your machine):**

- Start Postgres (and Redis if you use it). Set `DATABASE_URL` in `.env` or the environment.
- **Terminal 1 – API:** `cd apps\api` then `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- **Terminal 2 – Web:** `cd apps\web` then `npm install` and `npm run dev`
- Run `.\scripts\verify-api-data.ps1` (API base: `http://localhost:8000`), then open **http://localhost:3000**

---

## Steps to run with real data locally

### 1. Start the stack with a database

**Option A – Docker (simplest)**

```bash
# From repo root
docker-compose up -d postgres redis
docker-compose up api web
```

**Option B – Local API + existing Postgres**

- Ensure PostgreSQL is running and you have a database (e.g. `block70`).
- Set `DATABASE_URL` (e.g. `postgresql+psycopg2://user:pass@localhost:5432/block70`).
- Run the API: `cd apps/api && uvicorn app.main:app --reload`.
- Run the web app: `cd apps/web && npm run dev`.

### 2. Bootstrap coins (so Coins page and e.g. SOL use API data)

After the API is up and connected to the DB, run **once**:

**PowerShell (Windows):**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/scan/bootstrap/coins" -Method POST
```

**Bash / cmd (with curl):**
```bash
curl -X POST http://localhost:8000/api/v1/scan/bootstrap/coins
```

(Alternatively, if your API has the root route: `POST http://localhost:8000/bootstrap/coins`.)

This syncs the first page of coins from CoinGecko into the `coins` table. After that:

- **Coins** page will use `GET /api/v1/coins` (real list).
- **Coin detail** (e.g. `/coins/solana`) will use `GET /api/v1/coins/solana` (real data).  
  (If you haven’t run bootstrap yet, the frontend falls back to mock so SOL still works.)

### 3. (Optional) Seed opportunities

To populate opportunities (arbitrage pipeline):

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/scan/arbitrage" -Method POST
```

**Bash:**
```bash
curl -X POST http://localhost:8000/scan/arbitrage
```

The scheduler also runs this every 2 minutes, so opportunities will fill in over time if the API is left running.

### 4. (Optional) Seed AI insights

To get some AI insights in the feed:

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/ai/insights/seed-examples" -Method POST
```

**Bash:**
```bash
curl -X POST http://localhost:8000/api/v1/ai/insights/seed-examples
```

---

## Summary

- **Deployment is not required** for real data. Run **Postgres + API** (and optionally Redis) with a valid `DATABASE_URL`.
- **Bootstrap once:** `POST /bootstrap/coins` to load coins from CoinGecko so the Coins page and coin detail (e.g. SOL) use API/DB data instead of mock.
- **Ongoing:** Scheduler jobs (coin sync, arbitrage, news, etc.) keep the DB updated. When you deploy later, the same API + DB + pipelines run in production; no change in how “real” data works.

When you **do** deploy, you run the same stack (DB + API + workers/scheduler) in your environment and point the frontend at the deployed API; the site will still show real information from the database, not mock.

### 5. (Optional) CoinMarketCap fallback for pages 6–20

CoinGecko’s free tier typically limits the coins list to the first ~500 coins. Pages 6–20 of the Coins page can use **CoinMarketCap** as a fallback when configured:

1. Sign up for a free API key at [coinmarketcap.com/api](https://coinmarketcap.com/api/)
2. Set the env var: `CMC_API_KEY=your-api-key`

With this set, when CoinGecko returns empty for pages 6+, the API will fetch from CoinMarketCap instead. Both sources are cached for 90 seconds to stay under rate limits.

---

## If pages are still empty

**You do not need to deploy.** Empty pages usually mean one of:

1. **The API is not connected to PostgreSQL**  
   The API must have `DATABASE_URL` set and Postgres must be running. If the API starts without a DB, it still runs but DB-dependent endpoints return empty or errors.

2. **Bootstrap or scan didn’t run or failed**  
   Call the bootstrap and scan endpoints and check for errors (see below).

3. **The frontend is not talking to the API that has the DB**  
   If you run multiple APIs or the wrong port, the UI may be hitting an instance with no data.

**Verify in PowerShell (from repo root):**

```powershell
.\scripts\verify-api-data.ps1
```

This script checks health, runs the coin bootstrap, and then checks that `GET /api/v1/coins` and opportunities return data. If “coins” is still 0 after bootstrap, the API is likely not connected to the database (wrong or missing `DATABASE_URL`, or Postgres not running).

**When using Docker:**  
Use `docker-compose up -d postgres redis` then `docker-compose up api web`. The API container gets `DATABASE_URL` from docker-compose and talks to the `postgres` container. Then run:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/scan/bootstrap/coins" -Method POST
Invoke-RestMethod -Uri "http://localhost:8000/scan/arbitrage" -Method POST
```

Then open `http://localhost:8000/api/v1/coins` in a browser or run `.\scripts\verify-api-data.ps1` to confirm coins and opportunities are returned. Only after the API returns data will the website at localhost:3000 show it; deployment does not change that.
