-- Crypto content engine: feeds → raw articles → clustered topics → hourly reports
-- → social posts & videos → publishing audit trail.
--
-- Target DDL (feeds, articles, topics, reports, social_posts, videos, publishing_logs).
-- WARNING: 001_init.sql already creates topics / junction tables under older names
-- (rss_sources, raw_articles, topic_articles → articles). Use this file on a clean DB,
-- or drop/rename legacy objects and backfill before applying.
--
-- Hourly idempotency: reports.hour_bucket = UTC start-of-hour (unique).
-- pipeline_runs: optional FK from reports; CREATE IF NOT EXISTS for coexistence with 001.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optional: only if not created by 001_init.sql
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ok', 'failed')),
  error        TEXT,
  stats        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started ON pipeline_runs (started_at DESC);

-- ---------------------------------------------------------------------------
-- feeds (RSS / Atom / future sources)
-- ---------------------------------------------------------------------------
CREATE TABLE feeds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  feed_url        TEXT NOT NULL,
  feed_type       TEXT NOT NULL DEFAULT 'rss'
    CHECK (feed_type IN ('rss', 'atom', 'json', 'custom')),
  weight          NUMERIC(6, 4) NOT NULL DEFAULT 1.0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_fetch_at   TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feeds_feed_url_key UNIQUE (feed_url)
);

CREATE INDEX idx_feeds_active ON feeds (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_feeds_last_fetch ON feeds (last_fetch_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- articles (raw items ingested from feeds)
-- ---------------------------------------------------------------------------
CREATE TABLE articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id       UUID NOT NULL REFERENCES feeds (id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  link          TEXT NOT NULL,
  summary       TEXT,
  author        TEXT,
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash  TEXT NOT NULL,
  raw_extras    JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT articles_content_hash_key UNIQUE (content_hash)
);

CREATE INDEX idx_articles_feed_fetched ON articles (feed_id, fetched_at DESC);
CREATE INDEX idx_articles_fetched ON articles (fetched_at DESC);
CREATE INDEX idx_articles_published ON articles (published_at DESC NULLS LAST);
CREATE INDEX idx_articles_link ON articles (link);

-- ---------------------------------------------------------------------------
-- topics (clustered story lines)
-- ---------------------------------------------------------------------------
CREATE TABLE topics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL,
  headline         TEXT NOT NULL,
  summary          TEXT,
  rank_score       NUMERIC (12, 4) NOT NULL DEFAULT 0,
  article_count    INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'published', 'quarantined')),
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topics_slug_key UNIQUE (slug)
);

CREATE INDEX idx_topics_rank ON topics (rank_score DESC, last_updated_at DESC);
CREATE INDEX idx_topics_status_updated ON topics (status, last_updated_at DESC);
CREATE INDEX idx_topics_first_seen ON topics (first_seen_at DESC);

-- Many-to-many: which raw articles belong to a topic cluster
CREATE TABLE topic_articles (
  topic_id    UUID NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  article_id  UUID NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, article_id)
);

CREATE INDEX idx_topic_articles_article ON topic_articles (article_id);
CREATE INDEX idx_topic_articles_linked ON topic_articles (linked_at DESC);

-- ---------------------------------------------------------------------------
-- reports (one hourly bundle / narrative output)
-- ---------------------------------------------------------------------------
CREATE TABLE reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id  UUID REFERENCES pipeline_runs (id) ON DELETE SET NULL,
  -- Start of the logical hour (store UTC; app layer uses date_trunc('hour', ts) consistently)
  hour_bucket      TIMESTAMPTZ NOT NULL,
  title            TEXT,
  slug             TEXT,
  summary          TEXT,
  body             TEXT,
  body_format      TEXT NOT NULL DEFAULT 'markdown'
    CHECK (body_format IN ('markdown', 'html', 'plain')),
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'published', 'failed', 'superseded')),
  meta             JSONB NOT NULL DEFAULT '{}',
  stats            JSONB NOT NULL DEFAULT '{}',
  word_count       INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at     TIMESTAMPTZ,
  CONSTRAINT reports_hour_bucket_key UNIQUE (hour_bucket)
);

CREATE INDEX idx_reports_hour ON reports (hour_bucket DESC);
CREATE INDEX idx_reports_pipeline ON reports (pipeline_run_id);
CREATE INDEX idx_reports_status ON reports (status, updated_at DESC);
CREATE INDEX idx_reports_published ON reports (published_at DESC NULLS LAST);

CREATE TABLE report_topics (
  report_id        UUID NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  topic_id         UUID NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  sort_order       INT NOT NULL DEFAULT 0,
  rank_at_snapshot NUMERIC (12, 4),
  headline_snapshot TEXT,
  PRIMARY KEY (report_id, topic_id)
);

CREATE INDEX idx_report_topics_topic ON report_topics (topic_id);
CREATE INDEX idx_report_topics_order ON report_topics (report_id, sort_order);

-- ---------------------------------------------------------------------------
-- social_posts (drafts + scheduled + published copies)
-- ---------------------------------------------------------------------------
CREATE TABLE social_posts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id          UUID REFERENCES reports (id) ON DELETE SET NULL,
  topic_id           UUID REFERENCES topics (id) ON DELETE SET NULL,
  platform           TEXT NOT NULL
    CHECK (platform IN ('linkedin', 'twitter', 'x', 'facebook', 'threads', 'bluesky', 'other')),
  status             TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  content            TEXT NOT NULL,
  content_format     TEXT NOT NULL DEFAULT 'plain'
    CHECK (content_format IN ('plain', 'markdown')),
  external_post_id   TEXT,
  external_permalink TEXT,
  meta               JSONB NOT NULL DEFAULT '{}',
  scheduled_at       TIMESTAMPTZ,
  published_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_posts_report ON social_posts (report_id, created_at DESC);
CREATE INDEX idx_social_posts_topic ON social_posts (topic_id, created_at DESC);
CREATE INDEX idx_social_posts_status ON social_posts (status, scheduled_at NULLS LAST);
CREATE INDEX idx_social_posts_platform_pub ON social_posts (platform, published_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- videos (scripts, render jobs, published assets)
-- ---------------------------------------------------------------------------
CREATE TABLE videos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id          UUID REFERENCES reports (id) ON DELETE SET NULL,
  topic_id           UUID REFERENCES topics (id) ON DELETE SET NULL,
  title              TEXT,
  script             TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'rendering', 'ready', 'published', 'failed')),
  provider           TEXT,
  external_job_id    TEXT,
  asset_url          TEXT,
  duration_seconds   INT,
  thumbnail_url      TEXT,
  meta               JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at       TIMESTAMPTZ
);

CREATE INDEX idx_videos_report ON videos (report_id, created_at DESC);
CREATE INDEX idx_videos_topic ON videos (topic_id, created_at DESC);
CREATE INDEX idx_videos_status ON videos (status, updated_at DESC);
CREATE INDEX idx_videos_job ON videos (external_job_id) WHERE external_job_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- publishing_logs (append-only audit / retries / webhooks)
-- ---------------------------------------------------------------------------
CREATE TABLE publishing_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  TEXT NOT NULL
    CHECK (target_type IN ('report', 'social_post', 'video', 'topic', 'article')),
  target_id    UUID NOT NULL,
  channel      TEXT NOT NULL,
  operation    TEXT NOT NULL DEFAULT 'publish',
  status       TEXT NOT NULL
    CHECK (status IN ('pending', 'success', 'retrying', 'failed', 'skipped')),
  attempt      INT NOT NULL DEFAULT 1,
  http_status  INT,
  payload      JSONB NOT NULL DEFAULT '{}',
  response     JSONB NOT NULL DEFAULT '{}',
  error        TEXT,
  duration_ms  INT,
  idempotency_key TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_publishing_logs_target ON publishing_logs (target_type, target_id, created_at DESC);
CREATE INDEX idx_publishing_logs_channel ON publishing_logs (channel, created_at DESC);
CREATE INDEX idx_publishing_logs_status ON publishing_logs (status, created_at DESC);
CREATE INDEX idx_publishing_logs_idempotency ON publishing_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- updated_at touch helpers (optional; call from app or triggers)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feeds_set_updated_at ON feeds;
CREATE TRIGGER feeds_set_updated_at
  BEFORE UPDATE ON feeds FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS topics_set_updated_at ON topics;
CREATE TRIGGER topics_set_updated_at
  BEFORE UPDATE ON topics FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS reports_set_updated_at ON reports;
CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS social_posts_set_updated_at ON social_posts;
CREATE TRIGGER social_posts_set_updated_at
  BEFORE UPDATE ON social_posts FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS videos_set_updated_at ON videos;
CREATE TRIGGER videos_set_updated_at
  BEFORE UPDATE ON videos FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
