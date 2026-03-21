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
| `FRONTEND_ORIGIN` | Your frontend origin for CORS (e.g. `https://block70.com`) |
| `REDIS_URL` | Default `redis://redis:6379/0` in Docker – chart cache uses Redis |
| `DATABASE_URL` | PostgreSQL connection string |
| `SITEMAP_BASE_URL` | Base URL for sitemap (e.g. `https://block70.com`) |

## Chart cache (new)

- Chart data is cached in **Redis** to avoid CoinGecko 429 rate limits.
- Redis must be running: `docker-compose up -d postgres redis` before API.
- If Redis is down, chart cache falls back to in-memory (per instance only).
