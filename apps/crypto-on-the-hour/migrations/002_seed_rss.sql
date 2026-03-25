-- Default crypto news RSS feeds (CoinTelegraph, decrypt.co sample). Add/remove as needed.

INSERT INTO rss_sources (name, feed_url, weight, is_active)
VALUES
  ('CoinTelegraph', 'https://cointelegraph.com/rss', 1.2, TRUE),
  ('Decrypt', 'https://decrypt.co/feed', 1.1, TRUE)
ON CONFLICT (feed_url) DO NOTHING;
