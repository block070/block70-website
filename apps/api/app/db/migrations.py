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
    # chart_pack_snapshots: full OHLCV + indicators JSON for Block70 charts API
    """CREATE TABLE IF NOT EXISTS chart_pack_snapshots (
        id SERIAL PRIMARY KEY,
        coin_slug VARCHAR(128) NOT NULL,
        timeframe VARCHAR(8) NOT NULL,
        pack_json TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_chart_pack_slug_tf UNIQUE (coin_slug, timeframe)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_chart_pack_snapshots_slug ON chart_pack_snapshots (coin_slug)",
    "CREATE INDEX IF NOT EXISTS ix_chart_pack_snapshots_updated ON chart_pack_snapshots (updated_at)",
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
    # Seed default exchange affiliate rows (requires exchange_affiliate_links from SQLAlchemy create_all)
    """INSERT INTO exchange_affiliate_links (provider_key, venue_type, display_name, url_template, is_active)
    VALUES
      ('coinbase', 'cex', 'Coinbase', NULL, true),
      ('binance_us', 'cex', 'Binance.US', NULL, true),
      ('kraken', 'cex', 'Kraken', NULL, true)
    ON CONFLICT (provider_key) DO NOTHING""",
    # Category directory: M2M + snapshot (limits CoinGecko; feeds GET /api/v1/categories)
    "ALTER TABLE coins ADD COLUMN IF NOT EXISTS categories_synced_at TIMESTAMP WITH TIME ZONE",
    "CREATE INDEX IF NOT EXISTS ix_coins_categories_synced_at ON coins (categories_synced_at)",
    """CREATE TABLE IF NOT EXISTS crypto_categories (
        slug VARCHAR(160) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS coin_crypto_categories (
        coin_id INTEGER NOT NULL REFERENCES coins(id) ON DELETE CASCADE,
        category_slug VARCHAR(160) NOT NULL REFERENCES crypto_categories(slug) ON DELETE CASCADE,
        rank_in_coin INTEGER NOT NULL DEFAULT 0,
        source VARCHAR(32) NOT NULL DEFAULT 'legacy',
        assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        PRIMARY KEY (coin_id, category_slug)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_coin_crypto_categories_slug ON coin_crypto_categories (category_slug)",
    "CREATE INDEX IF NOT EXISTS ix_coin_crypto_categories_coin ON coin_crypto_categories (coin_id)",
    """CREATE TABLE IF NOT EXISTS category_aggregate_snapshots (
        category_slug VARCHAR(160) PRIMARY KEY REFERENCES crypto_categories(slug) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        market_cap DOUBLE PRECISION NOT NULL DEFAULT 0,
        volume_24h DOUBLE PRECISION NOT NULL DEFAULT 0,
        market_cap_change_24h DOUBLE PRECISION,
        avg_block70 INTEGER NOT NULL DEFAULT 0,
        avg_change_24h DOUBLE PRECISION,
        coin_count INTEGER NOT NULL DEFAULT 0,
        top_coins_json TEXT
    )""",
    # Developer API keys: Stripe-style dashboard (label, scopes, IP allowlist)
    "ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_label VARCHAR(128)",
    "ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes JSONB",
    "ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ip_allowlist JSONB",
    # api_usage: HTTP status per hit for error analytics
    "ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS http_status INTEGER",
    "CREATE INDEX IF NOT EXISTS ix_api_usage_http_status ON api_usage (http_status)",
    # users: subscription denorm + trials (Block70 monetization tiers)
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE",
    "CREATE INDEX IF NOT EXISTS ix_users_last_seen_at ON users (last_seen_at)",
    "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE",
    """CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        email_digest BOOLEAN NOT NULL DEFAULT TRUE,
        email_realtime BOOLEAN NOT NULL DEFAULT TRUE,
        email_marketing BOOLEAN NOT NULL DEFAULT TRUE,
        push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        notify_opportunity BOOLEAN NOT NULL DEFAULT TRUE,
        notify_whale BOOLEAN NOT NULL DEFAULT TRUE,
        notify_narrative BOOLEAN NOT NULL DEFAULT TRUE,
        notify_signal BOOLEAN NOT NULL DEFAULT TRUE,
        notify_trial BOOLEAN NOT NULL DEFAULT TRUE,
        notify_reengage BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_notification_preferences_user_id ON notification_preferences (user_id)",
    """CREATE TABLE IF NOT EXISTS email_send_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        template_key VARCHAR(64) NOT NULL,
        subject VARCHAR(512) NOT NULL,
        status VARCHAR(32) NOT NULL,
        dedupe_key VARCHAR(128) UNIQUE,
        error TEXT,
        metadata_json JSONB,
        digest_utc_date DATE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMP WITH TIME ZONE
    )""",
    "CREATE INDEX IF NOT EXISTS ix_email_send_logs_user_id ON email_send_logs (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_email_send_logs_template ON email_send_logs (template_key)",
    """CREATE TABLE IF NOT EXISTS notification_delivery_daily (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_utc DATE NOT NULL,
        channel VARCHAR(32) NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )""",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_delivery_user_day_ch ON notification_delivery_daily (user_id, day_utc, channel)",
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
