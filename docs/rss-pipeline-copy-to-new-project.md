# Step-by-step: copy the RSS → articles pipeline into another project

This guide assumes you want the **full** pipeline from Block70 (RSS ingest → clustering → ranking → OpenAI articles → webhooks), not the lighter FastAPI “headlines only” path.

**Source in Block70:** folder `apps/crypto-on-the-hour/`.

---

## Part A — What to copy from Block70

### A1. Copy the whole app folder (recommended)

Treat **`apps/crypto-on-the-hour`** as a **single deployable unit**. Copy **everything** under that directory **except** generated dependencies and build output.

**Include:**

| Path (under `apps/crypto-on-the-hour/`) | Purpose |
|----------------------------------------|---------|
| `src/` | TypeScript source |
| `migrations/` | Postgres schema and seed SQL |
| `scripts/` | Helpers (e.g. `verify-pipeline-config.ts`, LinkedIn scripts if you use them) |
| `package.json` | Dependencies and npm scripts |
| `package-lock.json` | Reproducible installs (if present) |
| `tsconfig.json` | TypeScript config |
| `.env.example` | Env template |
| `docker-compose.yml` | Optional local Postgres + Redis |
| `README.md` | App-specific notes |
| `docs/` | Only if you rely on LinkedIn setup (`docs/LINKEDIN_COMPANY_PAGE_SETUP.md`) |

**Do not copy:**

| Path | Reason |
|------|--------|
| `node_modules/` | Run `npm install` in the destination |
| `dist/` | Run `npm run build` to regenerate |

### A2. Optional reference docs (no runtime)

You may also copy or bookmark (not required for the app to run):

- [`docs/rss-article-pipeline.md`](rss-article-pipeline.md) — env reference and webhook contract
- [`packages/crypto-news-pipeline/MODULES.md`](../packages/crypto-news-pipeline/MODULES.md) — what to strip for a non-crypto fork

### A3. How to copy (pick one)

**Option 1 — File explorer / drag-and-drop**

1. In Block70, open `apps/crypto-on-the-hour`.
2. Delete `node_modules` and `dist` there if they exist (or skip copying them).
3. Copy the remaining folder into your other machine or repo.

**Option 2 — Command line from Block70 repo root**

```bash
# Example: copy into a sibling directory (adjust DEST)
DEST=../my-other-repo/services/news-pipeline
mkdir -p "$DEST"
rsync -a --exclude node_modules --exclude dist apps/crypto-on-the-hour/ "$DEST/"
```

On Windows PowerShell, you can use `robocopy`:

```powershell
robocopy .\apps\crypto-on-the-hour C:\path\to\my-repo\services\news-pipeline /E /XD node_modules dist
```

**Option 3 — Git**

- New repo: add Block70 as a remote and **subtree** or **cherry-pick** the folder’s history (advanced), or copy files once and commit in the new repo.

---

## Part B — Where to put it in the other project

Pick one layout and stay consistent.

| Layout | Example path | Notes |
|--------|----------------|------|
| **Monorepo app** | `your-repo/apps/news-pipeline/` | Matches Block70 style; run all commands **inside** that folder. |
| **Single-service repo** | `your-repo/` (repo root = pipeline) | Paste contents of `crypto-on-the-hour` at root; `package.json` is the service root. |
| **Backend folder** | `your-repo/backend/rss-articles/` | Same as above: that folder must contain `package.json`, `src/`, `migrations/`. |

The pipeline **does not** have to live inside a Next.js app. It is a **separate Node process** (API + worker) with its **own** Postgres database (or schema — migrations assume a dedicated DB).

---

## Part C — Integrate into the other project

### C1. Rename on disk (optional)

The folder name can be anything (e.g. `news-pipeline`). You do **not** need to rename it `crypto-on-the-hour`. Product naming for webhooks and logs is controlled by **`PIPELINE_SLUG`** and **`PIPELINE_DISPLAY_NAME`** in env (see Part D).

### C2. `package.json` name field (optional)

In the copied `package.json`, you may change the `"name"` field to match your org (e.g. `"@acme/news-pipeline"`). This is only for npm identification; it does not change runtime behavior.

### C3. Install dependencies

In **the directory that contains** `package.json`:

```bash
cd /path/to/your/copied/pipeline
npm install
```

### C4. Provision Postgres and Redis

You need:

- **PostgreSQL** (16+ is a safe target; check Block70 `README` if versions change)
- **Redis** (for BullMQ queues)

Either:

- Use your cloud provider’s managed Postgres + Redis, or  
- Run the included **`docker-compose.yml`** from the pipeline folder (adjust ports in `.env` to match the compose file).

Create an empty database for this service, e.g.:

```sql
CREATE DATABASE my_news_pipeline;
```

### C5. Create `.env`

```bash
cp .env.example .env
```

Edit `.env` with at least:

- `DATABASE_URL` — URL pointing at **your** new database  
- `REDIS_URL` — URL pointing at **your** Redis  
- `OPENAI_API_KEY` — for article generation on the worker host  

See **Part D** for the full configuration checklist.

### C6. Run migrations

Still in the pipeline directory:

```bash
npm run db:migrate
```

This creates tables (`rss_sources`, `raw_articles`, `topics`, etc.).  
`db:migrate` only needs **`DATABASE_URL`** (not Redis/OpenAI).

### C7. Feeds (RSS sources)

Choose one:

1. **Env-only (good for other projects):** set `RSS_FEEDS_JSON` in `.env`:

   ```env
   RSS_FEEDS_JSON=[{"source":"Example News","url":"https://example.com/feed.xml"}]
   ```

   On each ingest pass, feeds are upserted into `rss_sources`.

2. **Database:** keep or edit seed rows from migrations (e.g. `002_seed_rss.sql` in `migrations/`) before migrating, or `INSERT` into `rss_sources` manually after migrate.

### C8. Build and optional config lint

```bash
npm run build
npm run verify:pipeline
```

`verify:pipeline` validates optional JSON in env and prompt file paths **without** requiring `DATABASE_URL`.

### C9. Run processes in production (or locally)

You need **two** long-running processes from this folder:

| Process | Dev command | Production-style |
|---------|-------------|------------------|
| HTTP API | `npm run dev` | `npm run build` then `npm start` |
| Worker (cron pipeline) | `npm run worker` | `npm run build` then `npm run start:worker` |

- API: health checks on the port set by `API_PORT` (default **4001**).  
- Worker: runs the scheduled job (`PIPELINE_CRON_PATTERN` / `PIPELINE_CRON_TZ`) and calls OpenAI + webhooks.

Use your host’s process manager (systemd, Docker, Kubernetes, PM2, etc.) to keep **both** alive.

### C10. Website / CMS webhook

If you want generated Markdown in **your** site:

1. Implement an HTTP **POST** endpoint that accepts the payload described in [`rss-article-pipeline.md`](rss-article-pipeline.md) (website webhook contract).
2. Set in `.env`:

   ```env
   WEBSITE_PUBLISH_WEBHOOK_URL=https://your-domain.com/api/your-ingest-route
   WEBSITE_PUBLISH_SECRET=your-shared-secret
   ```

3. Your route must be reachable **from the worker machine** (firewall, Docker networking, TLS).

Block70’s Next.js route is only an **example**; your other project should implement the same contract or adapt.

---

## Part D — Configuration checklist on the other project

Work through this in `.env`:

### D1. Required for a working pipeline

| Variable | Action |
|----------|--------|
| `DATABASE_URL` | Set to your Postgres database for **this** service only. |
| `REDIS_URL` | Set to your Redis used by BullMQ. |
| `OPENAI_API_KEY` | Set on the host that runs the **worker**. |

### D2. Identity (per project — avoids “crypto on the hour” naming)

| Variable | Action |
|----------|--------|
| `PIPELINE_SLUG` | Kebab-case id (e.g. `acme-industry-digest`). Used as webhook JSON `source`, idempotency prefix, health `service`, etc. |
| `PIPELINE_DISPLAY_NAME` | Human-readable name (e.g. `Acme Industry Digest`) for alerts. |

### D3. Scheduling and topic window

| Variable | Typical use |
|----------|-------------|
| `PIPELINE_CRON_PATTERN` | When the full pipeline runs (default hourly). |
| `PIPELINE_CRON_TZ` | IANA timezone for that cron. |
| `TOPIC_LOOKBACK_HOURS` | How far back “recent news” goes for clustering/ranking. |
| `MIN_TOPIC_SCORE_TO_GENERATE` | Minimum score to generate an article. |

### D4. RSS

| Variable | Typical use |
|----------|-------------|
| `RSS_FEEDS_JSON` | Feed list without editing DB. |
| `RSS_USER_AGENT` | Identify your fetcher to feed operators. |

### D5. Non-crypto / custom vertical

| Variable | Typical use |
|----------|-------------|
| `TOPIC_RANK_KEYWORDS_JSON` | Your keyword → weight map for ranking. |
| `ARTICLE_SYSTEM_PROMPT` or `ARTICLE_SYSTEM_PROMPT_FILE` | Your editor voice and format instructions. |
| `MENTIONED_ASSETS_JSON` | Tokens to detect for “mentioned assets” / linking (if you keep that logic). |

### D6. Publishing and optional integrations

| Variable | Typical use |
|----------|-------------|
| `WEBSITE_PUBLISH_WEBHOOK_URL` | Your ingest URL. |
| `WEBSITE_PUBLISH_SECRET` | Shared secret for your webhook. |
| LinkedIn / video envs | Only if you keep those publishers; see `.env.example` and LinkedIn doc in the copied `docs/` folder. |

### D7. Observability (optional)

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Error tracking (API + worker). |
| `SLACK_WEBHOOK_URL` | Pipeline failure alerts. |

---

## Part E — Verify end-to-end

1. `GET` `/health` on the API (with correct port) returns `ok: true`.  
2. After one cron tick (or a manual trigger if you expose it): `raw_articles` gains rows, topics exist, and `content_pieces` may contain `seo_article` rows.  
3. Your webhook receives a POST with `format: "markdown"` and returns **2xx**.  
4. If something fails, check worker logs first (OpenAI, DB, Redis, webhook URL).

---

## Part F — What not to do

- Don't copy **only** a few files from `src/` into an unrelated codebase without bringing `migrations/`, `package.json`, and the worker entrypoint — imports and schema will not line up.  
- Don't point `DATABASE_URL` at a database that already has **conflicting** table names unless you intentionally namespace or fork migrations.  
- Don't assume Block70’s `apps/web` routes exist in your project; implement your own webhook or reuse the payload contract.

---

## Related

- Env tables and webhook JSON fields: [`rss-article-pipeline.md`](rss-article-pipeline.md)  
- Module checklist (strip LinkedIn, etc.): [`packages/crypto-news-pipeline/MODULES.md`](../packages/crypto-news-pipeline/MODULES.md)  
- Commands and routes for local dev: [`apps/crypto-on-the-hour/README.md`](../apps/crypto-on-the-hour/README.md)
