# Signal Bot System Review

## Overview

The Signal Bot system sends Block70 signals to Telegram channels and Discord servers. Bots run every minute, respect per-bot config and rate limits, and support public/premium channel use cases.

---

## Models

| Model | Purpose |
|-------|--------|
| **SignalBot** | id, user_id, platform, bot_token, channel_id, is_active, config_json, created_at, updated_at |
| **BotSignalEvent** | id, signal_id, bot_id, sent_at, status — records each signal sent to each bot |
| **BotAnalytics** | id, bot_id, signals_sent, clicks, timestamp — for engagement/CTR (clicks require a redirect endpoint) |

**Referral tracking**: `Referral.referral_source` added; set to `"bot"` when users sign up via bot invite links. Registration accepts optional `ref_source` (e.g. `ref=CODE&ref_source=bot`).

---

## Message Formatting

| Service | Purpose |
|---------|--------|
| **signal_formatter.py** | `format_signal_message`, `format_signal_telegram_html`, `format_signal_discord_embed` — token, type, confidence, description, Block70 link |
| **signal_link_generator.py** | `get_signal_page_url(signal_id, token)`, `get_signal_share_url(signal_id)` — URLs back to Block70 |

Messages include: token symbol, signal type, confidence score, description (truncated), chain, and a “View on Block70” link.

---

## API Reliability

| Service | Implementation |
|---------|----------------|
| **telegram_bot.py** | `send_telegram_message`, `send_telegram_signal_alert` — Telegram Bot API, 15s timeout |
| **discord_bot.py** | `send_discord_signal_alert` — Discord webhook POST, 15s timeout |

Failures are recorded in `BotSignalEvent.status` (e.g. `"failed"`). Retries are not implemented; can be added in the dispatcher.

---

## Bot Dispatcher & Scheduling

| Component | Behavior |
|-----------|----------|
| **bot_dispatcher.py** | `run_signal_bot_dispatcher(db)` — loads active bots, gets unsent signals (last 60 min), applies per-bot config (min_confidence, signal_types, token_filter), sends up to 10 signals/hour per bot, records `BotSignalEvent` |
| **Rate limit** | `MAX_SIGNALS_PER_BOT_PER_HOUR = 10` — prevents spam |
| **Scheduler** | Job `signal_bot_dispatcher` runs every **1 minute** (IntervalTrigger(minutes=1)) |

---

## Bot Configuration (config_json)

- **min_confidence** (0–1): only send signals with confidence ≥ this.
- **signal_types**: list of allowed types (e.g. `["wallet_accumulation", "volume_spike"]`); empty = all.
- **token_filter**: list of token symbols or addresses; empty = all.

---

## Public / Premium Channels

- **bot_growth_engine.py**: `share_popular_to_public_bot(db, public_bot_id)` — sends high-confidence popular signals to a designated “public” bot. Can be called from a separate scheduler job or manually.
- **Premium**: use config `min_confidence` (e.g. 0.8) and/or `signal_types` to restrict to high-confidence or elite opportunity types.

---

## Bot Management API

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/v1/bots | GET | List current user’s bots (with signals_sent_24h) |
| /api/v1/bots | POST | Create bot (platform, bot_token, channel_id, config_json) |
| /api/v1/bots/{id} | GET | Get one bot |
| /api/v1/bots/{id} | PATCH | Update is_active, config_json |
| /api/v1/bots/{id} | DELETE | Delete bot |

---

## Frontend

| Route | Content |
|-------|--------|
| **/bots** | List bots, add Telegram/Discord bot, per-bot settings (min_confidence, signal types, token filter), delete, view signals_sent_24h |
| **components/bots/bot-settings.tsx** | UI for min_confidence, signal_types, token_filter; Save calls PATCH /api/v1/bots/{id} |
| **/admin/bots** | Admin dashboard: per-bot signals_sent_24h, signals_sent_7d, clicks_7d (requires admin) |

---

## Invite Links

- **Telegram**: Share the bot’s t.me link (e.g. t.me/YourBot) and the channel invite.
- **Discord**: Use the webhook URL as the “integration”; no invite link for webhooks. For a real Discord bot invite, a separate Discord bot app would be needed; current implementation is webhook-based.
- **Referral**: Use signup link with `?ref=USERCODE&ref_source=bot` so referrals from bot are tracked.

---

## Engagement Tracking

- **BotAnalytics**: clicks and signals_sent can be aggregated per bot. To record **clicks**, add a redirect endpoint (e.g. `/go/signal/{id}?bot={bot_id}`) that increments `BotAnalytics.clicks` (or `signals_sent` for consistency) and redirects to the signal page.
- Admin dashboard `/admin/bots` shows signals_sent_24h, signals_sent_7d, clicks_7d per bot.

---

## Checklist

| Item | Status |
|------|--------|
| Message formatting (token, type, confidence, link) | Done |
| Telegram Bot API send | Done |
| Discord webhook send | Done |
| Dispatcher (detect new, format, dispatch) | Done |
| Rate limiting (10/hour per bot) | Done |
| Per-bot config (types, confidence, tokens) | Done |
| Scheduler every 1 min | Done |
| Bot CRUD API | Done |
| /bots page + bot-settings | Done |
| /admin/bots performance | Done |
| Bot growth engine (public channel) | Done |
| Signal link generator | Done |
| Referral source = bot | Done |
| Bot system review doc | Done |

---

## Optional Next Steps

- Add retry (e.g. 1 retry with backoff) for failed Telegram/Discord sends.
- Implement click redirect endpoint and wire it to BotAnalytics for CTR.
- Add “invite link” generator for Telegram (t.me/bot?start=ref_CODE) and optional Discord bot invite.
- Encrypt `bot_token` at rest (e.g. Fernet or KMS); decrypt in dispatcher when sending.
