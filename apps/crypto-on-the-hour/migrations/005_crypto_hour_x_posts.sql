-- X (Twitter) posts for Crypto On The Hour: at most one tweet per briefing (topic_id),
-- up to two per Chicago clock hour via slot_index 0 (~:05) and 1 (~:35).

CREATE TABLE IF NOT EXISTS crypto_hour_x_posts (
  topic_id          UUID PRIMARY KEY,
  hour_bucket_start TIMESTAMPTZ NOT NULL,
  slot_index        SMALLINT NOT NULL CHECK (slot_index IN (0, 1)),
  x_post_id         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crypto_hour_x_posts_hour_slot
  ON crypto_hour_x_posts (hour_bucket_start, slot_index);
