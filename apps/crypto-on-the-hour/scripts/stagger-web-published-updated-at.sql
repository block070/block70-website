-- One-off (run manually): stagger web_published_articles.updated_at to distinct top-of-hour
-- times in America/Chicago, newest row = current hour start, each older row −1 hour.
-- Safe to re-run only if you accept re-staggering from "now" again.

WITH ordered AS (
  SELECT topic_id,
    (row_number() OVER (ORDER BY updated_at DESC, topic_id) - 1) AS hour_back
  FROM web_published_articles
)
UPDATE web_published_articles AS w
SET updated_at =
  (
    date_trunc('hour', now() AT TIME ZONE 'America/Chicago')
    AT TIME ZONE 'America/Chicago'
  )
  - (o.hour_back || ' hours')::interval
FROM ordered AS o
WHERE w.topic_id = o.topic_id;
