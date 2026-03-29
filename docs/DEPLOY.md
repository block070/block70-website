# Block70 Deploy Checklist

## Push & restart (your flow)

1. **Push to server**
   ```bash
   git push
   ```

2. **On server, pull and rebuild**
   ```bash
   git pull
   docker-compose down
   docker-compose build --no-cache api web
   docker-compose up -d
   ```

## Environment (`.env` on server)

Ensure these are set for production:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Public API URL (e.g. `https://api.block70.com`) – used by browser |
| `API_SERVER_URL` | **Server-side only**: Where the FastAPI backend runs. In Docker, if `http://api:8000` fails (DNS/network), use `http://host.docker.internal:8000` (requires `extra_hosts` in docker-compose). |
| `FRONTEND_ORIGIN` | Comma-separated CORS origins (e.g. `https://block70.com,http://108.175.11.229:3000`) – required for status page to fetch API directly |
| `REDIS_URL` | Default `redis://redis:6379/0` in Docker – chart cache uses Redis |
| `DATABASE_URL` | PostgreSQL connection string |
| `SITEMAP_BASE_URL` | Base URL for sitemap (e.g. `https://block70.com`) |

### Password reset (`/forgot-password`)

1. **Next → FastAPI**: The proxy uses `getBackendApiBase()` (same as health/narratives). Set `API_SERVER_URL` on the web host so server-side routes can reach Python.
2. **PostgreSQL** (once): if the API returns 503 mentioning migrations, run:

   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(128);
   ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
   ```

3. **SMTP**: See `apps/api/.env.example` — without `SMTP_HOST`, the API accepts forgot-password requests but **does not send** email (token is not saved until send succeeds).

### Status page "Backend API unreachable"

The status page fetches **directly from the API** in the browser (bypassing the web container). Ensure:

1. `NEXT_PUBLIC_API_BASE_URL` points to the API (e.g. `http://108.175.11.229:8000` or `https://api.block70.com`)
2. `FRONTEND_ORIGIN` includes your frontend domain (e.g. `https://block70.com,http://108.175.11.229:3000`) so CORS allows the fetch

## Yellow banner: "Backend API: fetch failed"

The site **only monitors** the API (`GET /api/health/services` → your FastAPI `/health`). It **does not** restart containers or processes.

1. **SSH to the server** that runs the Block70 stack (same host as Docker or wherever the API listens).
2. **Restart the API** (from repo root, where `docker-compose.yml` lives):

   ```bash
   docker compose restart api
   ```

   Container name may be `block70-api`; equivalent:

   ```bash
   docker restart block70-api
   ```

3. **If that does not fix it**, inspect logs and recreate:

   ```bash
   docker compose logs -f api --tail 150
   docker compose up -d --force-recreate api
   ```

4. **Config**: Ensure Vercel/host env has `API_SERVER_URL` (or `NEXT_PUBLIC_API_BASE_URL`) pointing at a URL the **Next.js server** can actually reach (see table above). A wrong URL produces the same banner even when the API is healthy on localhost.

### Optional: cron self-heal (Linux VPS)

From repo root, run every 5 minutes (adjust `API_HEALTH_URL` if the API is not on localhost:8000):

```bash
*/5 * * * * cd /path/to/block70 && API_HEALTH_URL=http://127.0.0.1:8000/health ./scripts/restart-api-if-unhealthy.sh >> /var/log/block70-api-watch.log 2>&1
```

This only restarts the `api` service when `/health` fails; it does not replace proper monitoring.

## Chart cache (new)

- Chart data is cached in **Redis** to avoid CoinGecko 429 rate limits.
- Redis must be running: `docker-compose up -d postgres redis` before API.
- If Redis is down, chart cache falls back to in-memory (per instance only).
