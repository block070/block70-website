# Phase 1 — Static Repository Analysis: Top 25 Critical Blocking Issues

**No code modified in Phase 1.** This list is the result of static scan and import/compile checks.

---

## Critical / Blocking

| # | Category | Issue | Location / Notes |
|---|----------|--------|-------------------|
| 1 | **Docker** | API Dockerfile CMD runs `uvicorn main:app`; app module is `app.main`, so CMD should be `uvicorn app.main:app` | `apps/api/Dockerfile` line 15 |
| 2 | **Docker** | docker-compose.yml builds `web` from `./apps/web` but no Dockerfile exists in `apps/web`; `docker-compose up` will fail for web | `docker-compose.yml` + `apps/web/` |
| 3 | **Environment** | Backend expects PostgreSQL at DATABASE_URL; if not set or DB down, endpoints using `get_db()` fail at request time | `app/db/session.py`; all routes using Depends(get_db) |
| 4 | **Environment** | Redis used by event consumer job; if Redis down, job raises unless caught (already handled in scheduler) | `app/services/streaming/event_stream.py` |
| 5 | **Environment** | `.env` file not in repo (expected); docker-compose references `.env`; run instructions should document required vars | Root `.env` for compose |

---

## High (can block run or correct behavior)

| # | Category | Issue | Location / Notes |
|---|----------|--------|-------------------|
| 6 | **API** | GET `/api/v1/opportunities` requires Pro auth (`require_pro`); unauthenticated requests return 403 | `app/api/v1/opportunities.py` list_opportunities |
| 7 | **API** | GET `/api/v1/opportunities/top` returns MarketOpportunity (different table from Opportunity); pipeline writes to Opportunity | Two opportunity concepts: Opportunity (engine) vs MarketOpportunity (opportunity_engine) |
| 8 | **Dependencies** | psycopg2-binary may fail to build on Windows without PostgreSQL dev tools; prebuilt wheel or `--only-binary` needed | `requirements.txt` |
| 9 | **Backend** | DB table creation deferred to startup event; if DB unreachable at startup, tables never created until next start with DB up | `app/main.py` _init_db |
| 10 | **Frontend** | NEXT_PUBLIC_API_BASE_URL optional (defaults to http://localhost:8000); wrong value breaks API calls | `apps/web` env |

---

## Medium (correctness / consistency)

| # | Category | Issue | Location / Notes |
|---|----------|--------|-------------------|
| 11 | **Type annotation** | list_opportunities return type annotated as `List[Opportunity]`; response_model is `List[OpportunityRead]` (works but inconsistent) | `app/api/v1/opportunities.py` |
| 12 | **Tests** | 8 pytest tests skipped when DATABASE_URL not set; full coverage requires running PostgreSQL | `tests/conftest.py` db_session fixture |
| 13 | **API** | POST `/scan/arbitrage` commits in pipeline; requires DB; returns empty list if no signals pass extractor threshold | `app/services/pipeline/opportunity_pipeline.py` |
| 14 | **Schema** | OpportunityRead has `id`, `created_at`, `updated_at`; Opportunity model has these; serialization can fail if datetime timezone issues | `app/schemas/opportunity_db.py` |
| 15 | **Scheduler** | Multiple jobs depend on DB (arbitrage, radar, etc.); if DB down at startup, _init_db skips and jobs may fail when they run | `app/jobs/scheduler.py` |

---

## Lower (warnings / docs)

| # | Category | Issue | Location / Notes |
|---|----------|--------|-------------------|
| 16 | **Docs** | Run instructions scattered (README, STABILIZATION_REPORT, SELF_HEALING_REPORT); single source of truth would help | Various docs |
| 17 | **Dependencies** | pytest in requirements.txt (needed for tests); not required for production run | `requirements.txt` |
| 18 | **Frontend** | No Dockerfile for web in monorepo; docker-compose web build will fail without adding one | `apps/web` |
| 19 | **Backend** | Stripe required for billing router import; already in requirements | `app/api/v1/billing.py` |
| 20 | **Backend** | apscheduler required for scheduler; already in requirements | `app/jobs/scheduler.py` |

---

## Non-blocking (verified OK)

| # | Check | Result |
|---|--------|--------|
| 21 | Python syntax | 0 errors (ast parse of app/**/*.py) |
| 22 | Backend import | `from app.main import app` succeeds |
| 23 | TypeScript | `npx tsc --noEmit` passes (apps/web) |
| 24 | Circular imports | None detected; app loads |
| 25 | SQLAlchemy relationships | Opportunity ↔ OpportunitySignal; models load |

---

**Summary:** Most critical fix is **#1 (Dockerfile CMD)** for Docker-based runs. **#2 (web Dockerfile)** blocks `docker-compose up web`. Rest are environment or consistency items; backend and frontend compile and run when deps and (for DB features) PostgreSQL are available.
