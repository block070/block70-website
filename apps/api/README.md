# Block70 API – Opportunity Engine

This backend implements the Opportunity Engine foundation for Block70. It turns raw crypto source data into normalized, scored opportunities using a modular FastAPI + SQLAlchemy + Pydantic stack.

## Key Concepts

- **Connectors** – Fetch raw, unopinionated data from external sources (mocked for now).
- **Signals** – Typed, explainable signals extracted from raw data.
- **Normalizer** – Converts signals into a single normalized `Opportunity` shape.
- **Scoring Engine** – Computes per-dimension scores and an aggregate `total_score`.
- **Pipeline** – Orchestrates `fetch → extract signals → normalize → score → deduplicate → persist`.
- **Deduplication** – Ensures repeated scans update existing active opportunities instead of creating duplicates.
- **Expiration** – Different opportunity types can expire on different schedules.

## Structure

Under `apps/api/app`:

- `models/`
  - `opportunity.py` – SQLAlchemy models for `Opportunity` and `OpportunitySignal`.
- `schemas/`
  - `opportunity_db.py` – Pydantic schemas mirroring the DB-backed `Opportunity` models.
  - `signals.py` – Typed signal models (e.g. `ArbitrageSignal`).
- `services/`
  - `connectors/arbitrage_mock_connector.py` – Mock arbitrage connector (raw DEX quotes only).
  - `signals/arbitrage_signals.py` – Arbitrage signal extractor operating on mock quotes.
  - `scoring/scoring_engine.py` – Explainable scoring engine.
  - `pipeline/opportunity_normalizer.py` – Normalizes signals into `Opportunity` objects.
  - `pipeline/opportunity_pipeline.py` – Orchestrates the arbitrage pipeline.
  - `pipeline/deduplication.py` – Deduplication and upsert logic.
  - `pipeline/expiration.py` – Expiration calculations.
- `agents/`
  - `arbitrage_agent.py` – Agent that runs the arbitrage pipeline.

The FastAPI app in `app/main.py` wires these pieces together and exposes typed REST endpoints.

## Running the Backend Locally

### With Docker (recommended)

From the repository root:

```bash
cp .env.example .env
docker-compose up --build api postgres redis
```

This will:

- Start PostgreSQL (and Redis, reserved for future background jobs)
- Build and run the FastAPI app on `http://localhost:8000`

On first startup, the app will:

- Create database tables
- Run the mock arbitrage agent once to seed realistic sample opportunities

You can then hit:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/api/v1/opportunities`
- `POST http://localhost:8000/scan/arbitrage`

### Direct local run

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Ensure Postgres is running and matches apps/api/.env.example settings, then:
uvicorn app.main:app --reload
```

The same endpoints (`/health`, `/api/v1/opportunities`, `/scan/arbitrage`) will be
available on `http://localhost:8000`.

## Extending the Engine

- Add new connectors (e.g. miner ROI, wallet tracking) under `services/connectors/`.
- Add corresponding signal extractors under `services/signals/`.
- Extend the normalizer and scoring engine so new opportunity types still emit the same normalized `Opportunity` model.
- Add new agents in `agents/` that call into the shared pipeline.

