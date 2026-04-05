# Crypto-on-the-hour → generic RSS → news → articles (module inventory)

Template source: [`apps/crypto-on-the-hour`](../../apps/crypto-on-the-hour) in the Block70 monorepo. **Per fork:** copy that app (or subtree) into a new repo per client deployment.

## Keep (core pipeline)

| Area | Path | Role |
|------|------|------|
| RSS ingest | `src/modules/ingestion/rss.service.ts`, `ingestion-source.ts` | Fetch feeds, dedupe `content_hash`, upsert `raw_articles`. |
| Env feed sync | `src/modules/ingestion/rss-feeds-env-sync.ts` | Optional `RSS_FEEDS_JSON` → upsert `rss_sources` (no DB seed edits). |
| Clustering | `src/modules/clustering/cluster.service.ts` | Jaccard title similarity, topic merge; uses `TOPIC_LOOKBACK_HOURS`. |
| Ranking | `src/modules/ranking/topic-ranker.ts` | Heuristic scores; keywords configurable via `TOPIC_RANK_KEYWORDS_JSON`. |
| Hourly runner | `src/pipeline/hourly.runner.ts` | Orchestrates ingest → cluster → rank → generate → publish. |
| AI | `src/modules/ai/*.ts` | `content-generator`, `openai.client`, optional `internal-link-injector` for Block70. |
| Publishers | `src/publishers/*.ts` | Webhook + LinkedIn; keep contracts per project. |
| DB schema | `migrations/*.sql` | Postgres tables for sources, articles, topics, content, publish events. |
| Worker / cron | `src/workers/index.ts`, `config.pipelineCronPattern` | BullMQ scheduled pipeline. |

## Parameterize (domain-specific today)

| Area | Path | What to change per project |
|------|------|----------------------------|
| AI system prompt | `config.ARTICLE_SYSTEM_PROMPT` / `ARTICLE_SYSTEM_PROMPT_FILE` | Replace crypto editor voice with your vertical. |
| Product name | `PIPELINE_SLUG`, `PIPELINE_DISPLAY_NAME` in `config.ts` | Webhook `source`, job ids, anchors, alerts — different name per project without renaming the folder. |
| Rank keywords | `config.TOPIC_RANK_KEYWORDS_JSON` | Replace crypto ETF/SEC/boosts with your taxonomy. |
| Mentioned “assets” | `config.MENTIONED_ASSETS_JSON` | Replace ticker list in `topic-assets.ts` or disable injector. |
| RSS User-Agent | `config.RSS_USER_AGENT` | Identify your bot to feed operators. |
| Publishers | `website.publisher.ts`, webhooks | Payload shape for your CMS (document in runbook). |

## Strip or simplify (optional MVP)

| Area | Path | Notes |
|------|------|-------|
| LinkedIn / video | `social-generator.ts`, `video-script-generator.ts`, `linkedin.publisher.ts` | Remove if you only need Markdown → webhook. |
| Internal linking | `internal-link-injector.ts` | Block70-specific; pass-through or delete for generic sites. |
| Crypto Hour X | migrations `005_*`, related routes | Crypto product only. |
| `topic-assets` refresh | `topic-assets.ts` | If `MENTIONED_ASSETS_JSON` is empty, code can skip asset extraction (optional future flag). |

## Related (Block70 main product, not this template)

- FastAPI news ingest: `apps/api/app/services/news/` — good for **headlines API only**, not full article generation.
- Web RSS fallback: `apps/web/lib/news/rss-direct-fallback.ts` — browser/Next fallback pattern.
