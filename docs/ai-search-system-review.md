# AI Search System Review

## Overview

The AI Search system lets users ask natural language questions and receive answers built from **real-time platform data** (signals, wallet activity, capital flows, narratives, opportunities, AI insights, radar). No external LLM is required for the core flow: the **query processor** interprets intent, the **data retrieval engine** fetches from the database, and the **response generator** produces human-readable text.

## Query Understanding

- **AIQueryProcessor** (`services/ai/ai_query_processor.py`):
  - Normalizes input (lowercase, collapse whitespace).
  - Infers **data sources** from keywords (e.g. "whale" → wallet_activity, "narrative" → narratives, "volume" → signals/radar).
  - Extracts **token symbol** via simple pattern (2–10 uppercase letters).
  - Sets **intent**: whales_buying, trending_narratives, unusual_volume, token_info, general.
- **Limitations**: No NLP or embedding-based understanding. Intent is keyword-driven. Token extraction is heuristic (first all-caps token). For richer understanding, consider adding an LLM or intent classifier.

## Response Accuracy

- **DataRetrievalEngine** pulls from:
  - Signals, opportunities, capital flows, market narratives, AI insights, radar events, wallet leaderboard.
- **ResponseGenerator** uses intent + retrieved data to build answers:
  - Template-style answers (e.g. "Top smart wallets by profit: …", "Trending narratives: …").
  - Token-specific answers summarize signal count, radar events, flows, insights for that symbol.
- **Confidence score** is derived from which data sources returned results (signals, narratives, opportunities, etc.), not from model probability. Stored with each query for analytics.
- **Recommendation**: Add optional LLM pass to refine or expand answers; keep template path for speed and cost control.

## Performance

- **Read path**: Single POST triggers process → retrieve → generate. No N+1; retrieval uses limited `.limit()` and indexed columns (token_symbol, status, created_at).
- **Caching**: In-memory cache keyed by normalized query text (max 200 entries). Repeated identical questions return cached answer without DB retrieval.
- **History**: GET `/api/v1/ai-search/history` is a single query filtered by user_id, ordered by created_at.
- **Analytics**: Each search records to **AISearchAnalytics** (normalized query, hit_count, last_seen_at). **Query ranking** (`query_ranking.py`) exposes most popular queries for suggested questions.

## Personalization

- **User context** is not yet used in retrieval or generation. Planned extensions:
  - **user portfolio**: filter or boost tokens the user holds.
  - **tracked tokens**: from TokenWatch / watchlist.
  - **watched narratives**: from user preferences.
- **AISearchQuery** stores `user_id` when the user is authenticated; history is per-user.

## Integration

- **AI insights**: Data retrieval fetches **AIInsight** rows; response generator can reference them in the answer and in `related_insights`.
- **Token-specific questions**: If the processor extracts a token symbol, retrieval filters signals, radar, flows, opportunities, and insights by that token.
- **Real-time data**: All data is read from the current DB state (signals, radar, flows, etc.), so answers reflect latest ingested data.

## API Summary

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/ai-search` | Submit query_text; return answer, confidence, related_tokens, related_signals, opportunities, insights, radar. |
| GET | `/api/v1/ai-search/popular` | Most common queries (for suggested questions). |
| GET | `/api/v1/ai-search/history` | Current user's previous searches (auth optional). |

## Data Models

- **AISearchQuery**: id, user_id (nullable), query_text, response_text, confidence_score, response_metadata (JSONB), created_at.
- **AISearchAnalytics**: id, query_normalized, hit_count, last_seen_at, created_at.

## Frontend

- **/ai-search**: Large search bar, suggested questions, display of **AIAnswer** (answer + related tokens, signals, opportunities, insights, radar with links).
- **/ai-search/history**: List of past searches for the logged-in user.
- **Suggested questions**: "What tokens are whales buying?", "What narratives are trending?", "What tokens have unusual volume?", etc.

## Recommendations

1. **Query understanding**: Add optional LLM or intent classifier for complex or ambiguous questions.
2. **Personalization**: Use portfolio and TokenWatch in retrieval and in response ordering/boosting.
3. **Caching**: Consider Redis or DB-backed cache for cross-process cache sharing.
4. **Confidence**: Expose confidence in the UI (already in AIAnswer) and optionally filter low-confidence answers or ask for clarification.
5. **Analytics**: Use AISearchAnalytics to tune suggested questions and to detect failing or low-value queries.
