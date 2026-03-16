# Opportunity Engine Tests

Automated pytest suite for the Opportunity Engine pipeline.

## What’s covered

| Area | File | Description |
|------|------|-------------|
| **Connector output** | `test_connector.py` | `ArbitrageMockConnector`, `ArbitrageQuote`, `fetch_or_mock` |
| **Signal extraction** | `test_signal_extraction.py` | `ArbitrageSignalExtractor`, net edge, liquidity validation |
| **Normalization** | `test_normalizer.py` | `OpportunityNormalizer.normalize_arbitrage_db` |
| **Scoring** | `test_scoring_engine.py` | `ScoringEngine.score`, `ScoringContext`, clamping |
| **Deduplication** | `test_deduplication.py` | `upsert_opportunity_by_identity`, `deduplicate_opportunity_by_identity` |
| **Expiration** | `test_expiration.py` | `compute_expires_at`, `is_expired`, `expire_stale_opportunities` |
| **Pipeline** | `test_pipeline_integration.py` | Full `OpportunityPipeline.run_arbitrage` flow |

## Run tests

From `apps/api`:

```bash
# Unit tests only (no database required)
python -m pytest tests/ -v

# With database (set DATABASE_URL so deduplication, expiration, pipeline tests run)
set DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/block70
python -m pytest tests/ -v
```

- **Without `DATABASE_URL`:** 41 tests run, 8 are skipped (deduplication, expiration DB, pipeline integration).
- **With `DATABASE_URL`:** All 49 tests run (assuming DB is up and schema exists).

## Options

- `-v` — verbose
- `-k "connector or normalizer"` — run only tests whose name matches
- `--tb=short` — shorter tracebacks
