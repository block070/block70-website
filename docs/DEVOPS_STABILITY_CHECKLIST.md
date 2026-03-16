# Block70 – DevOps Stability Checklist

Autonomous stabilization status. Aligned with `/docs/product.md`, `/docs/architecture.md`, `/docs/agents.md`. No new features; compilation, runtime, dependencies, pipeline, and API only.

---

## Audit Results (Current)

| Check | Status | Notes |
|-------|--------|------|
| Backend import | ✅ Pass | `python -c "from app.main import app"` succeeds |
| Backend runtime | ✅ Pass | `uvicorn app.main:app` starts; `GET /health` → 200 |
| Frontend build | ✅ Pass | `npm run build` completes (78 pages) |
| Opportunity Engine tests | ✅ Pass | 41 passed, 8 skipped (DB-dependent) |
| Dependencies | ✅ Listed | Backend: `apps/api/requirements.txt`; Frontend: `apps/web/package.json` |

---

## Quick Run Commands

**Backend (from repo root):**
```bash
cd apps/api
pip install -r requirements.txt
# If psycopg2-binary fails on Windows: pip install psycopg2-binary --only-binary psycopg2-binary
uvicorn app.main:app --reload
```
→ http://localhost:8000 · Docs: http://localhost:8000/docs · Health: http://localhost:8000/health

**Frontend:**
```bash
cd apps/web
npm install
npm run dev
```
→ http://localhost:3000

**Tests (Opportunity Engine):**
```bash
cd apps/api
python -m pytest tests/ -v
```

---

## Pipeline Correctness

- **Opportunity Engine:** Connector → signals → normalization → scoring → deduplication → persistence (see `app/services/pipeline/opportunity_pipeline.py`).
- **Agents:** Arbitrage, Miner, Wallet (see `app/agents/`). Scheduler jobs in `app/jobs/scheduler.py`.
- **API:** Scan endpoints under `/api/v1/scan`; opportunities under `/api/v1/opportunities` and root `/scan/arbitrage` (see `app/main.py`).

---

## Environment Notes

- **PostgreSQL:** Required for DB-backed endpoints. Default URL: `postgresql+psycopg2://block70:block70password@localhost:5432/block70` or set `DATABASE_URL`.
- **Redis:** Optional; used for event streaming. App starts without it; event consumer job skips cleanly when Redis is down.
- **Stability:** Backend defers DB init to startup so the app can start without PostgreSQL; `/health` works either way.
