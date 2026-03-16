"""
Pytest configuration and shared fixtures for Opportunity Engine tests.

DB-dependent tests use a real PostgreSQL session when DATABASE_URL is set;
otherwise they are skipped so unit tests can run without a database.
"""
from __future__ import annotations

import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Only import app modules when we need them (e.g. for db_session)
# so unit tests that don't need DB can run without DB deps loading.


def _get_test_engine():
    """Create engine from DATABASE_URL; return None if not set or invalid."""
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        return None
    try:
        engine = create_engine(url, future=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return engine
    except Exception:
        return None


@pytest.fixture(scope="session")
def db_engine():
    """Session-scoped engine; None if no DATABASE_URL or connection fails."""
    return _get_test_engine()


@pytest.fixture
def db_session(db_engine):
    """
    Provide a real DB session for integration tests.
    Skips the test if no database is available.
    """
    if db_engine is None:
        pytest.skip("DATABASE_URL not set or database unavailable")
    from app.db import Base
    import app.models  # noqa: F401 - register models

    # Create tables if needed (use a test schema or same DB)
    Base.metadata.create_all(bind=db_engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
