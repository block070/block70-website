# Crypto On the Hour

Fully automated crypto content engine: **RSS → clustering → ranking → OpenAI (article + 60s video script + LinkedIn) → PostgreSQL → optional webhooks / social**.

## Folder structure

```
apps/crypto-on-the-hour/
├── migrations/           # SQL schema + seed RSS feeds
├── src/
│   ├── index.ts          # HTTP API entry
│   ├── config.ts
│   ├── api/server.ts     # Fastify routes
│   ├── db/               # pg pool + migrate runner
│   ├── queue/            # BullMQ queue factory + Redis
│   ├── workers/index.ts  # Worker + hourly cron registration
│   ├── pipeline/
│   │   └── hourly.runner.ts   # End-to-end hourly orchestration
│   ├── modules/
│   │   ├── ingestion/    # RSS + IngestionSource interface (extensible)
│   │   ├── clustering/   # Dedup + Jaccard topic merge
│   │   ├── ranking/      # Heuristic topic scores
│   │   └── ai/           # SEO article, video script, LinkedIn
│   └── publishers/       # Website webhook, video webhook, LinkedIn API
├── docker-compose.yml    # Optional local Postgres + Redis
├── package.json
└── README.md
```

## Prerequisites

- Node.js **20+**
- PostgreSQL **16+**
- Redis **7+**
- **OpenAI API key** (on the machine running the **worker**)

## Step-by-step setup

### 1. Create database

```bash
createdb crypto_on_the_hour
# or use Docker:
cd apps/crypto-on-the-hour && docker compose up -d
```

### 2. Environment

```bash
cd apps/crypto-on-the-hour
cp .env.example .env
```

For a **local publish smoke test**, use the same `WEBSITE_PUBLISH_SECRET` in **`apps/crypto-on-the-hour/.env`** and **`apps/web/.env.local`** — see defaults in **`.env.example`** and **`apps/web/crypto-hour-publish.env.sample`** (rotate before production).

Edit `.env`:

- `DATABASE_URL` — e.g. `postgres://postgres:postgres@127.0.0.1:5433/crypto_on_the_hour` (compose uses host **5433** → container 5432 when **5432** is busy)
- `REDIS_URL` — e.g. `redis://127.0.0.1:6380` (compose maps host **6380** → container 6379 if 6379 is busy on the host)
- `OPENAI_API_KEY` — required for generation (worker process)
- Optional publish hooks: `WEBSITE_PUBLISH_WEBHOOK_URL`, `VIDEO_GENERATION_WEBHOOK_URL`, LinkedIn tokens (see `.env.example`)

### 3. Install & migrate

```bash
npm install
npm run db:migrate
```

If you see `tsx: not found`, run **`npm install`** from **`apps/crypto-on-the-hour`** (not the repo root). Avoid `npm install --production` before migrate. After `npm run build`, you can use `npm run db:migrate:dist` instead.

`db:migrate` only requires **`DATABASE_URL`** in `.env` (not Redis or OpenAI).

This applies `001_init.sql` (tables) and `002_seed_rss.sql` (default feeds). Adjust feeds in DB or add rows to `rss_sources`.

### 4. Run API (terminal 1)

```bash
npm run dev
```

- Live (no DB): `GET http://localhost:4001/health/live`
- Health (incl. Postgres): `GET http://localhost:4001/health`
- List topics: `GET http://localhost:4001/content/topics`
- Topic detail: `GET http://localhost:4001/content/topics/:id`
- Manual enqueue: `POST http://localhost:4001/admin/trigger-hourly`  
  (optional header `X-Admin-Secret` if `ADMIN_TRIGGER_SECRET` is set)

### 5. Run worker (terminal 2)

```bash
npm run worker
```

Registers a **repeatable BullMQ job** on cron `0 * * * *` (top of every hour) and processes `hourly` jobs with concurrency `1`.

### 6. Production

```bash
npm run build
node dist/index.js          # API
node dist/workers/index.js  # Worker (or separate container)
```

Use a process manager (systemd, PM2, Kubernetes) with **at least two processes**: API + Worker.

## Pipeline behavior (each hour)

1. **Ingest** — Fetch all active `rss_sources`, upsert into `raw_articles` (content-hash dedup).
2. **Cluster** — Group similar headlines (token Jaccard) into `topics` + `topic_articles`.
3. **Rank** — Score topics (keywords, recency, article breadth). Base score supports `MIN_TOPIC_SCORE_TO_GENERATE`.
4. **Generate** — For top candidates without an existing `seo_article`, call OpenAI for:
   - `seo_article` (Markdown)
   - `video_script` (~60s)
   - `linkedin_post`
5. **Publish** — If env URLs/tokens are set, call website webhook, video webhook, LinkedIn; log `publish_events`.

## Extending ingestion

Implement `IngestionSource` in `src/modules/ingestion/ingestion-source.ts`, then persist via `upsertRawArticle` with a synthetic `source_id` or new `rss_sources` row. Plug orchestration into `hourly.runner.ts` after RSS (e.g. parallel `Promise.all`).

## Block70 monorepo note

This app is **standalone Node** alongside the existing Python/Next stack. Wire `WEBSITE_PUBLISH_WEBHOOK_URL` to the Block70 ingest route **`POST /api/publish/crypto-hour`** (see `apps/web/app/api/publish/crypto-hour/route.ts`). Use the **same Postgres** via `CRYPTO_HOUR_DATABASE_URL` on Vercel as `DATABASE_URL` on the engine so articles appear on **`/crypto-hour`** and **`/crypto-hour/:topicId`**.

- Health: `GET /health/pipeline` — returns `503` if the last hourly run is missing, failed, or older than ~2.5h (for uptime monitors).

## License

Internal / project license as per parent repo.
