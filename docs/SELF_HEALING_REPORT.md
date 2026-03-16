# Self-Healing Debug Mode – Report

Stability-focused fixes applied without changing product/architecture/agents or the Opportunity Engine design.

---

## 1. Summary of issues discovered

| # | Severity | Issue | Location |
|---|----------|--------|----------|
| 1 | **Blocking** | Backend failed to import: `ModuleNotFoundError: No module named 'stripe'` (and later `apscheduler`) when dependencies not installed | `app.main` → billing → stripe |
| 2 | **Blocking** | Backend failed at startup: `Base.metadata.create_all(bind=engine)` ran at import time and connected to PostgreSQL; when DB was down, the app never started | `app/main.py` |
| 3 | **Blocking** | Backend failed to import: `NameError: name '_run_signal_bot_dispatcher_job' is not defined` in scheduler | `app/jobs/scheduler.py` |
| 4 | **Noise** | With Redis down, `_run_event_consumer_job` raised every 5s and filled logs | `app/jobs/scheduler.py` |
| 5 | **Environment** | `pip install -r requirements.txt` can fail on Windows when building `psycopg2-binary` (needs pg_config); prebuilt wheel works with `--only-binary psycopg2-binary` | N/A |
| 6 | **Environment** | PostgreSQL and Redis not required for app to *start* after fixes; required for DB and streaming features | N/A |

**Not changed:** Frontend build was already passing. Opportunity Engine tests (41 passed, 8 skipped without DB) were already in place and passing.

---

## 2. Files modified

| File | Change |
|------|--------|
| `apps/api/app/main.py` | Moved DB table creation and seed from module load to `@app.on_event("startup")`; wrapped in `_init_db()` with try/except so app starts even when DB is unavailable |
| `apps/api/app/jobs/scheduler.py` | Defined missing `_run_signal_bot_dispatcher_job()` (wrapper around `run_signal_bot_dispatcher`); added `import redis.exceptions` and wrapped event consumer job in try/except for `redis.exceptions.ConnectionError` to avoid log spam when Redis is down |

---

## 3. Fixes applied

1. **Deferred DB initialization**  
   `Base.metadata.create_all(bind=engine)` and reward seeding no longer run at import time. They run in a startup event handler. If the database is unavailable, the exception is caught and the app still starts; `/health` and other endpoints that don’t need DB work.

2. **Scheduler job definition**  
   Implemented `_run_signal_bot_dispatcher_job()` so the scheduler no longer references an undefined name. The job calls `_with_db_session(run_signal_bot_dispatcher)`.

3. **Event consumer job resilience**  
   The event consumer job is wrapped in `try/except redis.exceptions.ConnectionError` so that when Redis is not running, the job skips quietly instead of raising and logging repeatedly.

4. **Dependencies**  
   No code change. All required packages are already in `requirements.txt`. Running `pip install -r requirements.txt` (and using a prebuilt `psycopg2-binary` wheel on Windows if needed) resolves missing-module errors.

---

## 4. Remaining warnings

- **PostgreSQL:** If `DATABASE_URL` is not set or the server is not running, the app starts but any endpoint that uses `get_db()` will fail at request time (e.g. `/api/v1/opportunities`, `POST /scan/arbitrage`). Tables are created on first successful startup when DB is available.
- **Redis:** If Redis is not running, the event consumer job does nothing each tick (no log spam). Other jobs (arbitrage, radar, etc.) still run if the DB is available.
- **Windows + psycopg2:** If `pip install -r requirements.txt` fails building `psycopg2-binary`, install it from a wheel:  
  `pip install psycopg2-binary --only-binary psycopg2-binary`
- **Pytest:** 8 tests are skipped when `DATABASE_URL` is not set (deduplication, expiration DB, pipeline integration). With a running PostgreSQL and `DATABASE_URL` set, all 49 tests run.

---

## 5. Instructions to run locally

### Backend (FastAPI)

1. **From repo root:**
   ```bash
   cd apps/api
   ```

2. **Optional but recommended – virtual environment:**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   If `psycopg2-binary` fails to build on Windows:
   ```bash
   pip install psycopg2-binary --only-binary psycopg2-binary
   pip install -r requirements.txt
   ```

4. **Optional – PostgreSQL and Redis:**
   - **PostgreSQL:** Create DB (e.g. `block70`) and set `DATABASE_URL` if not using default `postgresql+psycopg2://block70:block70password@localhost:5432/block70`.
   - **Redis:** Optional for streaming/event consumer; app runs without it.

5. **Start API:**
   ```bash
   uvicorn app.main:app --reload
   ```
   - API: http://localhost:8000  
   - Docs: http://localhost:8000/docs  
   - Health: http://localhost:8000/health (works even without DB)

### Frontend (Next.js)

1. **From repo root:**
   ```bash
   cd apps/web
   ```

2. **Install and run:**
   ```bash
   npm install
   npm run dev
   ```
   - App: http://localhost:3000  
   - Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` if the API is elsewhere.

### Opportunity Engine tests (pytest)

```bash
cd apps/api
python -m pytest tests/ -v
```

- Without `DATABASE_URL`: 41 tests run, 8 skipped (DB-dependent).  
- With PostgreSQL and `DATABASE_URL` set: all 49 tests run.

---

## Automated tests (Opportunity Engine)

Existing pytest suite under `apps/api/tests/` covers:

- **Connector:** `test_connector.py` – ArbitrageMockConnector, ArbitrageQuote, fetch_or_mock  
- **Signal extraction:** `test_signal_extraction.py` – ArbitrageSignalExtractor  
- **Normalization:** `test_normalizer.py` – OpportunityNormalizer.normalize_arbitrage_db  
- **Scoring:** `test_scoring_engine.py` – ScoringEngine, ScoringContext  
- **Deduplication:** `test_deduplication.py` – upsert_opportunity_by_identity (needs DB)  
- **Expiration:** `test_expiration.py` – compute_expires_at, is_expired, expire_stale (DB for last)  
- **Pipeline:** `test_pipeline_integration.py` – OpportunityPipeline.run_arbitrage (needs DB)

All runnable tests pass (41 passed, 8 skipped when DB is not configured).
