-- Mirror of articles ingested by Block70 web (POST /api/publish/crypto-hour).
-- Requires Next.js (or any consumer) to use same DATABASE_URL as this service.

CREATE TABLE web_published_articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id         UUID NOT NULL,
  topic_slug       TEXT NOT NULL,
  source           TEXT NOT NULL DEFAULT 'crypto-on-the-hour',
  title            TEXT NOT NULL,
  body_markdown    TEXT NOT NULL,
  meta             JSONB NOT NULL DEFAULT '{}',
  idempotency_key  TEXT NOT NULL,
  content_hash     TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT web_published_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT web_published_source_topic UNIQUE (source, topic_id)
);

CREATE INDEX idx_web_published_slug ON web_published_articles (topic_slug);
CREATE INDEX idx_web_published_updated ON web_published_articles (updated_at DESC);
