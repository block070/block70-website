# Signals Feed System

## Overview

The signals system provides a unified feed of wallet, market, radar, liquidity, and social signals. It includes detection, scoring, aggregation, APIs, and UI.

## Premium Signal Features

| Tier   | Signals feed        | Alerts              | Analytics      |
|--------|---------------------|---------------------|----------------|
| **Free**  | Delayed (15 min)    | —                   | —              |
| **Pro**   | Real-time           | —                   | Basic          |
| **Elite** | Real-time           | signal_alert type   | Advanced       |

- **Free**: Use `?tier=free` on `/api/v1/signals` and `/api/v1/signals/latest` to receive only signals older than 15 minutes.
- **Pro**: Omit `tier` or use `tier=pro` for real-time signals.
- **Elite**: Real-time signals plus ability to create `signal_alert` subscriptions (new signals, confidence threshold). Premium alert engine supports `signal_alert` in `alert_types` for subscriptions.

## Components

- **Signal model** (`signals` table): id, signal_type, token_symbol, token_address, chain, title, description, signal_strength, confidence_score, source, metadata_json, created_at.
- **Signal Detection Engine**: Normalizes RadarSignal, wallet, social, and market data into Signal records.
- **Signal Scoring Engine**: Computes signal_strength and confidence_score from volume, wallet reputation, market cap, recency.
- **Signal Aggregation Engine**: Combines multiple signals per token into aggregated events (and optional `aggregated` Signal records).
- **Trending Signal Engine**: Ranks tokens by signal count/confidence; powers `/api/v1/signals/trending` and `/leaderboard`.
- **Alert type `signal_alert`**: Users can create alerts that fire when new signals appear or exceed a confidence threshold. Conditions: `min_confidence`, `token_symbol`, `signal_type`.
- **Opportunity type `signal_cluster`**: When aggregated signals exist, the signal cluster pipeline creates opportunities of type `signal_cluster` (scheduler every 10 minutes).

## API Endpoints

- `GET /api/v1/signals` — list with filters: chain, signal_type, token, limit, offset, tier.
- `GET /api/v1/signals/latest` — latest signals; tier=free for delayed.
- `GET /api/v1/signals/trending` — tokens ranked by signal activity (hours, limit).
- `GET /api/v1/signals/leaderboard` — leaderboard by signal_strength, signal_count, or confidence_score.
- `GET /api/v1/signals/{token}` — signals for a token.

## Frontend

- **Pages**: `/signals` (feed), `/signals/[token]` (token signals + timeline + related opportunities), `/signals/trending`, `/signals/leaderboard`.
- **Components**: SignalCard, SignalFilters, SignalTimeline, SignalHeatmap, SignalFeedPanel (dashboard).
- **Dashboard**: Latest signals panel on main dashboard; nav link "Signals".

## Signal System Review

### Signal detection accuracy

- Detection normalizes from RadarSignal, WalletSignal, SocialActivitySignal, and market data. Accuracy depends on upstream pipeline quality (wallet connector, liquidity monitor, radar pipeline). Consider adding validation rules or confidence thresholds before persisting.

### Aggregation logic

- Aggregation groups by (token_symbol, token_address, chain), combines strength/confidence with a small boost for multiple signals. Weights per signal_type are configurable via `strength_weights`. Review thresholds (min_signals_to_aggregate) for noise vs. coverage.

### API performance

- List/latest use indexed columns (created_at, chain, signal_type, token_symbol). For very large tables, consider time-bounded queries or materialized views for trending/leaderboard. Trending and leaderboard aggregate in the request; a 10-minute cache or materialized snapshot would reduce load.

### UI responsiveness

- Feed page uses initial server-rendered data plus client-side filters and optional 30s polling. Token and trending/leaderboard pages are server-rendered with revalidate. Consider adding loading skeletons and error retry for critical paths.
