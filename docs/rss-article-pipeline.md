# RSS → news → articles pipeline (per-project deployment)

This document is the runbook for reusing Block70’s **full** RSS pipeline: ingest → cluster → rank → AI long-form article → webhooks. **Source of truth in this monorepo:** [`apps/crypto-on-the-hour`](../apps/crypto-on-the-hour).

For **headlines only** (no clustering or generation), use the FastAPI news stack under `apps/api` instead; see [`packages/crypto-news-pipeline/MODULES.md`](../packages/crypto-news-pipeline/MODULES.md).

## Fork / copy model

- **One deployment per project** — copy `apps/crypto-on-the-hour` into its own repo (or duplicate the folder per client).
- Do **not** rely on `packages/crypto-news-pipeline` for runtime code; that package is an inventory + doc anchor only.
- After changes in Block70, merge or cherry-pick updates into each fork as needed.

## Operational flow

1. **Migrate** Postgres (`npm run db:migrate` in the app directory).
2. **Configure** env (below); optionally set `RSS_FEEDS_JSON` so you never hand-edit seed SQL for feeds.
3. **Run worker** — BullMQ runs the pipeline on `PIPELINE_CRON_PATTERN` in `PIPELINE_CRON_TZ` (default: top of each hour).
4. **Publishing** — `WEBSITE_PUBLISH_WEBHOOK_URL` receives Markdown posts when generation runs.

Ingest runs inside the same scheduled job as clustering and generation (`hourly.runner`). There is no separate “ingest-only” cron unless you split the runner.

## Environment variables

### Required (typical)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | BullMQ / worker queue |
| `OPENAI_API_KEY` | Article generation (worker may warn if missing) |

### Product identity (set per fork)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIPELINE_SLUG` | `crypto-on-the-hour` | Kebab-case id: JSON `source` field on publish webhooks, idempotency key prefix, BullMQ repeatable job id suffix, `service` in `/health`, Sentry tag, and “Latest signals” fragment in generated Markdown (`#slug`). |
| `PIPELINE_DISPLAY_NAME` | `Crypto On the Hour` | Human-readable name in Slack alerts and logs. |

### Scheduling

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIPELINE_CRON_PATTERN` | `0 * * * *` | When the full pipeline runs |
| `PIPELINE_CRON_TZ` | `America/Chicago` | IANA timezone for the pattern |

### Topic window and scoring

| Variable | Default | Purpose |
|----------|---------|---------|
| `TOPIC_LOOKBACK_HOURS` | `24` | Recent window used in clustering and ranking (see `cluster.service.ts`, `topic-ranker.ts`) |
| `MIN_TOPIC_SCORE_TO_GENERATE` | `3` | Minimum `rank_score` for a topic to get an SEO article |

### RSS

| Variable | Purpose |
|----------|---------|
| `RSS_FEEDS_JSON` | Optional JSON array: `[{"source":"Site name","url":"https://…feed"}]` — upserts into `rss_sources` on every ingest pass (same idea as `NEWS_FEEDS_JSON` in FastAPI). |
| `RSS_USER_AGENT` | HTTP User-Agent for feed fetches (default `Block70-RssPipeline/1.0`). |

### Domain customization (non-crypto forks)

| Variable | Purpose |
|----------|---------|
| `TOPIC_RANK_KEYWORDS_JSON` | JSON object: substring (lowercased in code) → numeric boost for `topic-ranker`. Omit to use built-in crypto-oriented defaults. |
| `ARTICLE_SYSTEM_PROMPT` | Inline system prompt for the LLM. |
| `ARTICLE_SYSTEM_PROMPT_FILE` | Path to a UTF-8 file; if set and readable, overrides `ARTICLE_SYSTEM_PROMPT`. |
| `MENTIONED_ASSETS_JSON` | JSON array of uppercase tokens (e.g. tickers) for `mentioned_assets` / internal-link detection. Omit for the built-in crypto list. |

### Website webhook (primary publisher)

| Variable | Purpose |
|----------|---------|
| `WEBSITE_PUBLISH_WEBHOOK_URL` | POST target for generated articles (must be reachable from the worker host). |
| `WEBSITE_PUBLISH_SECRET` | Sent as `X-Publish-Secret` and `Authorization: Bearer …` when set. |

Other publishers (LinkedIn, video) are optional; see `apps/crypto-on-the-hour/.env.example`.

## Verify config before deploy

From `apps/crypto-on-the-hour`:

```bash
npm run build
npm run verify:pipeline
```

`verify:pipeline` checks optional JSON env vars and that `ARTICLE_SYSTEM_PROMPT_FILE` exists if set. It does **not** load full app config (no `DATABASE_URL` required), run migrations, or call OpenAI.

## Dedupe and idempotency

- **Articles:** `raw_articles.content_hash` (normalized URL + title) prevents duplicate rows.
- **Website publish:** `Idempotency-Key` header is derived from topic id + body hash (`website.publisher.ts`), so retries do not double-post if your receiver honors idempotency.

## Website webhook contract

The worker POSTs JSON to `WEBSITE_PUBLISH_WEBHOOK_URL`:

| Field | Type | Purpose |
|-------|------|---------|
| `topicId` | string | Topic UUID |
| `slug` | string | Suggested URL slug |
| `title` | string | Article title |
| `format` | `"markdown"` | Body format |
| `body` | string | Markdown content |
| `source` | string | Emitter id — set via **`PIPELINE_SLUG`** (defaults to `crypto-on-the-hour` in Block70) |
| `idempotencyKey` | string | Same value as `Idempotency-Key` header |

Headers:

- `Content-Type: application/json`
- `Idempotency-Key: <key>`
- If `WEBSITE_PUBLISH_SECRET` is set: `X-Publish-Secret` and `Authorization: Bearer <secret>`

Your CMS or Next.js route should validate the secret, accept the payload, and return a 2xx status on success.

## End-to-end checklist (manual)

1. Postgres + Redis up; migrations applied.
2. At least one row in `rss_sources` (via migration seed or `RSS_FEEDS_JSON`).
3. `OPENAI_API_KEY` set on the worker.
4. Trigger one pipeline run (wait for cron or use admin trigger if configured).
5. Confirm new rows in `raw_articles`, topics updated, `content_pieces` with `seo_article`, and webhook POST received.

## Related docs

- **Copy into another repo (step-by-step):** [`rss-pipeline-copy-to-new-project.md`](rss-pipeline-copy-to-new-project.md)
- Module keep/strip list: [`packages/crypto-news-pipeline/MODULES.md`](../packages/crypto-news-pipeline/MODULES.md)
- App-specific detail: [`apps/crypto-on-the-hour/README.md`](../apps/crypto-on-the-hour/README.md)
