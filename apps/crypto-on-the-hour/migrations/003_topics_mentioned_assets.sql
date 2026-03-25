-- Denormalized tickers / names per topic for coin-page filtering (GIN overlap queries).
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS mentioned_assets TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_topics_mentioned_assets ON topics USING GIN (mentioned_assets);
