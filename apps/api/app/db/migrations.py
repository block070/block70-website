"""
Schema migrations for Block70 API.

Runs on startup to add columns and make schema changes that create_all
does not handle (e.g. new columns on existing tables).
"""

from __future__ import annotations

import logging

from sqlalchemy import text

from app.db import engine

logger = logging.getLogger(__name__)

MIGRATIONS = [
    # chart_snapshots: persistent chart data (Storage → Binance.US → CoinGecko)
    """CREATE TABLE IF NOT EXISTS chart_snapshots (
        id SERIAL PRIMARY KEY,
        coin_slug VARCHAR(128) NOT NULL,
        days_param VARCHAR(16) NOT NULL,
        vs_currency VARCHAR(8) NOT NULL DEFAULT 'usd',
        prices_json TEXT NOT NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'coingecko',
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_chart_slug_days UNIQUE (coin_slug, days_param, vs_currency)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_chart_snapshots_coin_slug ON chart_snapshots (coin_slug)",
    "CREATE INDEX IF NOT EXISTS ix_chart_snapshots_days_param ON chart_snapshots (days_param)",
    "CREATE INDEX IF NOT EXISTS ix_chart_snapshots_updated_at ON chart_snapshots (updated_at)",
    # coins: whitepaper_url, explorer_url, telegram, market_cap_rank
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS whitepaper_url VARCHAR(1024)",
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS explorer_url VARCHAR(512)",
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS telegram VARCHAR(512)",
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS market_cap_rank INTEGER",
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS category_slug VARCHAR(160)",
    "CREATE INDEX IF NOT EXISTS ix_coins_category_slug ON coins (category_slug)",
    # news_articles: ensure all columns exist (legacy table may have minimal schema)
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS author VARCHAR(256)",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS summary TEXT",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS content TEXT",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) DEFAULT 'rss' NOT NULL",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS body_text TEXT",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS image_url VARCHAR(1024)",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS tags JSONB",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS tickers JSONB",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS entities JSONB",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS sentiment DOUBLE PRECISION DEFAULT 0.0 NOT NULL",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS engagement JSONB",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS dedupe_cluster_id INTEGER",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS rank_explanation JSONB",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS homepage_score DOUBLE PRECISION",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS coin_scores JSONB",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1 NOT NULL",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS dedupe_count INTEGER DEFAULT 1 NOT NULL",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS quality_status VARCHAR(32) DEFAULT 'keep' NOT NULL",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL",
    "ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL",
]


def run_migrations() -> None:
    """Apply schema migrations. Safe to call repeatedly (idempotent)."""
    try:
        with engine.connect() as conn:
            for stmt in MIGRATIONS:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                    logger.info("migration applied: %s", stmt[:80] + "..." if len(stmt) > 80 else stmt)
                except Exception as e:
                    conn.rollback()
                    logger.warning("migration skipped (may already exist): %s", e)
    except Exception as e:
        logger.warning("migrations could not run (DB may be unavailable): %s", e)
