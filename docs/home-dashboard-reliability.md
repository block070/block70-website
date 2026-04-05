# Homepage market snapshot — staying reliable

The trading-terminal **market snapshot** (mkt cap, 24h vol, BTC/ETH dominance) is built in [`apps/web/lib/home/build-home-dashboard.ts`](../apps/web/lib/home/build-home-dashboard.ts) and exposed at `GET /api/home/dashboard`.

## What caused “all dashes” before

Typical failure mode on **Docker / self-hosted**:

1. **`API_SERVER_URL`** pointed at an unreachable host (e.g. `http://api:8000` when the `api` service is down or not on the same network).
2. **No outbound HTTPS** from the `web` container to **CoinGecko** (firewall / no default route).
3. Result: empty **live tape** (`vk`), demo gainers/losers on the page, and **null hero totals** until fallbacks run.

Secondary issues we hardened in code:

- **SWR revalidation** replacing a good SSR payload with a worse client response → mitigated by **`mergeHeroFromSsr`** in [`intelligence-dashboard.tsx`](../apps/web/components/home/intelligence-dashboard.tsx).
- **Parallel CoinGecko bundle** timing out → **sequential** `fetchCoingeckoGlobal` + `fetchCoingeckoMarketsTop` when the bundle is weak, then a **late** global fetch, then **illustrative** placeholders only if numbers are still invalid (see `ILLUSTRATIVE_GLOBAL_HERO` in the builder — **not** live data).

## Operational checklist (production)

| Check | Why |
|--------|-----|
| Set **`API_SERVER_URL`** in the env file Compose injects into **`web`** | Server-side fetches use [`getBackendApiBase()`](../apps/web/lib/backend-api-base.ts); must hit a **working** FastAPI origin (`https://api.block70.com` or internal `http://api:8000` only if that service is healthy). |
| Keep **`api` service healthy** (if using internal URL) | `GET /api/v1/market/summary` must succeed from the Next container’s network perspective. |
| Allow **`https://api.coingecko.com`** egress from `web` (or use pro API + `COINGECKO_API_KEY`) | Fills gaps when Block70 API is slow or unavailable. |
| Avoid **`NEXT_PUBLIC_API_BASE_URL`** on the **same host as the marketing site** without **`API_SERVER_URL`** | `getBackendApiBase` may refuse the public URL; set **`API_SERVER_URL`** explicitly. |
| After deploy, smoke **`curl -sS "$ORIGIN/api/home/dashboard" \| jq .hero,.meta.marketSource`** | `meta.marketSource` containing **`illustrative-fallback`** means you are **not** on live globals — fix API/CG paths. |

## CI / PR discipline

From **`apps/web`** (see [`AGENTS.md`](../AGENTS.md)):

```bash
npm run verify:home
```

Run this when changing the home dashboard builder, `getBackendApiBase`, or CoinGecko fallbacks.

## Changing illustrative placeholders

Constants **`ILLUSTRATIVE_GLOBAL_HERO`** in `build-home-dashboard.ts` are **last-resort** UI ballparks so the snapshot is not blank. Prefer fixing env and networking; update the constants rarely and only to keep rough magnitudes plausible.
