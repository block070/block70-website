from __future__ import annotations

"""
SQLite helpers for the Crypto Articles on the Hour system.

We keep a lightweight automation.db that tracks which source articles have
already been processed, plus an optional logs table.
"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from .config import CONFIG


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(CONFIG.sqlite_path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS processed_articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                hash TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS automation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )
            """
        )
        conn.commit()


def mark_article_processed(title: str, url: str, hash_value: str) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO processed_articles (title, url, hash, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (title, url, hash_value, datetime.now(timezone.utc)),
        )


def has_article(hash_value: str) -> bool:
    with get_db() as conn:
        cur = conn.execute(
            "SELECT 1 FROM processed_articles WHERE hash = ? LIMIT 1",
            (hash_value,),
        )
        return cur.fetchone() is not None


def log_event(level: str, message: str) -> None:
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO automation_logs (level, message, created_at)
            VALUES (?, ?, ?)
            """,
            (level.upper(), message, datetime.now(timezone.utc)),
        )

