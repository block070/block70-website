# Block70 Developer API Platform Review

## Overview

The developer API turns Block70 into **infrastructure for crypto apps**. Developers use API keys to access signals, wallets, opportunities, market data, airdrops, strategies, and portfolio data.

---

## Authentication

| Item | Status |
|------|--------|
| API key model (id, user_id, hashed key, plan_type, rate_limit, created_at, last_used, is_active) | Done |
| Secure key generation (long random, store hash only) | Done – `services/api/api_key_generator.py` |
| X-API-Key header validation | Done – `core/api_auth_middleware.py` |
| Key prefix for display (e.g. bk70_xxxx…) | Done |
| Create / list / revoke keys (JWT auth) | Done – `POST /api/v1/api-keys/create`, `GET /list`, `POST /{id}/revoke` |

---

## Rate Limiting

| Plan | Limit (requests/day) |
|------|----------------------|
| Free | 100 |
| Developer | 1,000 |
| Pro | 10,000 |
| Elite | 50,000 |
| Enterprise | Unlimited |

- Engine: `services/api/rate_limit_engine.py` – daily window (UTC), usage stored in `ApiUsage`.
- 429 response when exceeded; `X-RateLimit-Limit` and `X-RateLimit-Remaining` (where applicable).
- Each developer API request records usage and updates `last_used` on the key.

---

## Endpoints (Developer API prefix: `/api/v1/dev`)

| Area | Endpoints | Notes |
|------|-----------|--------|
| **Signals** | GET /signals, /signals/latest, /signals/{token} | token, signal_type, confidence_score, timestamp |
| **Wallets** | GET /wallets, /wallets/{address}, /wallets/{address}/transactions | Leaderboard, profile, activity |
| **Opportunities** | GET /opportunities, /opportunities/{id} | type, alpha score, estimated ROI, confidence |
| **Market** | GET /market/prices, /market/trending, /market/gainers, /market/losers | Prices and movers |
| **Airdrops** | GET /airdrops, /airdrops/upcoming, /airdrops/active | Airdrop opportunities |
| **Strategies** | GET /strategies, /strategies/{id}, /strategies/backtests | User strategies and backtests |
| **Portfolio** | GET /portfolio, /portfolio/tokens, /portfolio/performance | User portfolio (key owner) |

All require `X-API-Key` and count toward rate limits.

---

## Webhooks

| Item | Status |
|------|--------|
| Webhook model (id, user_id, url, event_type, created_at) | Done |
| Events: new_signal, wallet_trade, opportunity_alert | Done |
| Register / list / delete (JWT auth) | Done – `POST/GET/DELETE /api/v1/webhooks/*` |
| Delivery service | Done – `services/api/webhook_delivery.py` (POST to URL with JSON payload) |
| Wire events into pipelines | Optional – call `notify_new_signal`, `notify_opportunity_alert` from signal/opportunity pipelines |

---

## API Usage Analytics

| Item | Status |
|------|--------|
| ApiUsage model (api_key_id, endpoint, request_count, timestamp) | Done |
| Record each developer API request | Done in dev_api routes |
| Analytics: by key, by endpoint | Done – `GET /api/v1/api-keys/analytics?days=7` |
| Developer analytics dashboard | Done – `/developers/analytics` |

---

## Developer Dashboard & Docs

| Route | Content |
|-------|---------|
| /developers | API keys (create/revoke), webhooks (add/delete), rate limits, base URL |
| /developers/docs | Endpoint list, request examples, auth and response format |
| /developers/analytics | Usage by key and by endpoint, period selector |

---

## SDK Examples

| Language | Location |
|----------|----------|
| Python | docs/sdk-examples/python_example.py |
| JavaScript | docs/sdk-examples/javascript_example.js |

Both use env vars for base URL and API key and show signals, opportunities, market, airdrops, wallets.

---

## Checklist: Endpoint Performance & Reliability

- [ ] Add response caching where appropriate (e.g. market/prices, trending) to reduce DB load.
- [ ] Consider async webhook delivery (e.g. background task) so request path is not blocked.
- [ ] Add timeouts and retries for webhook POSTs; optionally store delivery status (success/failure, status_code).
- [ ] Index ApiUsage(api_key_id, timestamp) and (endpoint, timestamp) for fast analytics queries.
- [ ] Optional: separate read replica for heavy read-only developer API traffic.

---

## Monetization (Reference)

| Plan | Example price |
|------|----------------|
| Free | $0 |
| Developer | $49/month |
| Pro API | $199/month |
| Enterprise | Custom |

Billing is not implemented; plan_type and rate_limit on ApiKey can be driven by subscription later.
