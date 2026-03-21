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
    # coins: whitepaper_url, explorer_url, market_cap_rank
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS whitepaper_url VARCHAR(1024)",
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS explorer_url VARCHAR(512)",
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS market_cap_rank INTEGER",
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
