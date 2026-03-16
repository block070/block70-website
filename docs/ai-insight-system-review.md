# AI Insight System Review

## Overview

The AI Insight system generates human-readable insights from platform data: signals, wallet activity, radar alerts, capital flows, and narrative trends. This document covers data accuracy, insight generation, and performance.

---

## 1. Data Accuracy

### Inputs

- **Signals**: `Signal` (token_symbol, confidence_score, signal_type, created_at). Used by trend detector (signal clusters) and confidence scoring.
- **Wallet activity**: `WalletProfile` (win_rate, average_roi, total_trades). Used by pattern analyzer (coordinated accumulation) and confidence (wallet reputation).
- **Radar events**: `RadarSignal` and `RadarEvent` (token_symbol, severity/strength). Used by trend detector and confidence.
- **Capital flows**: `CapitalFlow` (source_asset, destination_asset, amount, chain). Used by pattern analyzer (market rotation) and trend detector (inflows).
- **Narrative trends**: `MarketNarrative` (name, description, trend_score). Used by narrative analyzer and pattern analyzer.

### Checks

- **Staleness**: Engines use `created_at` / `timestamp` and optional `hours` look-back. Ensure pipelines populate these so insights reflect recent data.
- **Completeness**: Empty tables (e.g. no `CapitalFlow`, no `MarketNarrative`) will produce fewer or no insights for those categories. Seed or backfill as needed.
- **Consistency**: `related_tokens` on `AIInsight` is a JSONB array; token symbols should be normalized (e.g. uppercase) for filtering by token.

---

## 2. Insight Generation

### Pipeline

1. **Pattern analyzer** (`services/ai/pattern_analyzer.py`): Detects coordinated wallet accumulation, narrative momentum, market rotation.
2. **Trend detector** (`services/ai/trend_detector.py`): Detects signal clusters, capital inflows, radar activity.
3. **Narrative analyzer** (`services/ai/narrative_analyzer.py`): Identifies narratives gaining momentum (trend_score).
4. **Confidence scoring** (`services/ai/confidence_scoring.py`): Combines signal strength, wallet reputation, flow volume, radar severity into a 0–1 score.
5. **Summary generator** (`services/ai/insight_summary_generator.py`): Converts patterns/trends into title and summary (rule-based; can be extended with LLM).
6. **AI Insight Engine** (`services/ai/ai_insight_engine.py`): Orchestrates the above, persists `AIInsight` and `InsightSource`.

### Insight types

- `market_trend`: Rotation, volume/flow trends.
- `wallet_activity`: Coordinated accumulation, smart wallet moves.
- `narrative_shift`: Narrative momentum.
- `opportunity_alert`: High-inflow or high-signal opportunities.

### Triggering

- **API**: `POST /api/v1/ai/insights/generate` (optional `token`, `hours`).
- **Jobs**: Can be called from a scheduler (e.g. after radar/flow pipelines run) to keep the feed fresh.

---

## 3. Performance

### Database

- **AIInsight**: Indexed on `insight_type`, `created_at`. List/latest/top are ordered by `created_at` or `confidence_score`.
- **InsightSource**: FK to `ai_insights.id`; used for provenance.
- **AIInsightVote**: Indexed on `insight_id`, `user_identifier` (one vote per user per insight if enforced in app logic).
- **AIInsightPerformance**: One row per insight for outcome tracking; evaluate after a time window and set `was_accurate`, `outcome_score`, `evaluated_at`.

### Alerts and notifications

- **Premium alerts**: `evaluate_premium_alerts(..., high_confidence_insights=...)` supports type `ai_insight_alert`. Subscribers with `minimum_score` (0–100) receive triggers when `confidence_score * 100 >= threshold`.
- **Notifications**: `NotificationType.AI_INSIGHT` and `NARRATIVE_SHIFT` added in `notification_engine`. Call `notify_ai_insight` / `notify_narrative_shift` when delivering to in-app users (e.g. after resolving subscriber list to `user_id`).

### Recommendations

- Run insight generation on a schedule (e.g. hourly) after signal/flow/radar pipelines.
- Optionally cap the number of insights per run to avoid duplicate or noisy entries (e.g. dedupe by (insight_type, title hash) or time window).
- Use `AIInsightPerformance` to backtest accuracy and tune confidence weights or thresholds.

---

## 4. API Summary

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/ai/insights` | List insights (optional type, limit, offset) |
| `GET /api/v1/ai/insights/latest` | Latest insights (feed) |
| `GET /api/v1/ai/insights/top` | Top by confidence and recency |
| `GET /api/v1/ai/insights/{token}` | Insights related to token |
| `POST /api/v1/ai/insights/generate` | Trigger generation |
| `POST /api/v1/ai/insights/seed-examples` | Seed example insights |
| `POST /api/v1/ai/insights/{id}/vote` | Vote (1 / -1) on an insight |

---

## 5. Frontend

- **/insights**: Feed of latest AI insights.
- **/insights/history**: Historical list.
- **/insights/top**: Highest-impact insights.
- **/coins/[slug]/insights**: Insights for that coin (by symbol).
- **components/ai/insight-card.tsx**: Renders title, summary, confidence, related tokens.

---

## 6. Extending

- **LLM summaries**: Replace or augment `InsightSummaryGenerator` with calls to an LLM for title/summary.
- **AI-generated opportunities**: From `AIInsightEngine`, call `OpportunityEngine.emit()` or the existing opportunity pipeline when patterns meet criteria (e.g. high confidence + type `opportunity_alert`).
- **Voting and performance**: Use `AIInsightVote` to rank “most impactful” by vote sum; use `AIInsightPerformance` to close the loop on accuracy and adjust confidence weights.
