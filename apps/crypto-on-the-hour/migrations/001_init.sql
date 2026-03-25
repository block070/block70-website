-- Crypto On the Hour — initial schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE rss_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  feed_url    TEXT NOT NULL UNIQUE,
  weight      NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE raw_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID NOT NULL REFERENCES rss_sources(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  link          TEXT NOT NULL,
  summary       TEXT,
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash  TEXT NOT NULL,
  UNIQUE (content_hash)
);

CREATE INDEX idx_raw_articles_fetched ON raw_articles(fetched_at DESC);
CREATE INDEX idx_raw_articles_published ON raw_articles(published_at DESC NULLS LAST);

CREATE TABLE topics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL,
  headline        TEXT NOT NULL,
  summary         TEXT,
  rank_score      NUMERIC(10,4) NOT NULL DEFAULT 0,
  article_count   INT NOT NULL DEFAULT 1,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'published')),
  UNIQUE (slug)
);

CREATE TABLE topic_articles (
  topic_id   UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES raw_articles(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, article_id)
);

CREATE INDEX idx_topics_score ON topics(rank_score DESC, last_updated_at DESC);

CREATE TABLE content_pieces (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id     UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('seo_article', 'video_script', 'linkedin_post')),
  title        TEXT,
  body         TEXT NOT NULL,
  meta         JSONB NOT NULL DEFAULT '{}',
  model        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (topic_id, kind)
);

CREATE TABLE publish_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id     UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('website', 'video', 'linkedin', 'twitter')),
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  payload      JSONB NOT NULL DEFAULT '{}',
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_publish_events_topic ON publish_events(topic_id, created_at DESC);

CREATE TABLE pipeline_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
  error        TEXT,
  stats        JSONB NOT NULL DEFAULT '{}'
);
