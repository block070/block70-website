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
| `FRONTEND_ORIGIN` | Your frontend origin for CORS (e.g. `https://block70.com`) |
| `REDIS_URL` | Default `redis://redis:6379/0` in Docker – chart cache uses Redis |
| `DATABASE_URL` | PostgreSQL connection string |
| `SITEMAP_BASE_URL` | Base URL for sitemap (e.g. `https://block70.com`) |

### Status page "Backend API unreachable"

If `/status` shows this in Docker, `http://api:8000` may not resolve from the web container. Set in `.env`:
```bash
API_SERVER_URL=http://host.docker.internal:8000
```
(docker-compose includes `extra_hosts` so `host.docker.internal` reaches the host; port 8000 is mapped from the API container)

## Chart cache (new)

- Chart data is cached in **Redis** to avoid CoinGecko 429 rate limits.
- Redis must be running: `docker-compose up -d postgres redis` before API.
- If Redis is down, chart cache falls back to in-memory (per instance only).
