# Sentiment System Review

## Overview

The Block70 sentiment system lets users vote **bullish**, **neutral**, or **bearish** on tokens and surfaces aggregated sentiment on coin pages, leaderboards, and trending views. It supports comment discussions and an AI-generated sentiment summary.

## Accuracy

- **Aggregation**: `TokenSentimentSummary` is updated on every vote via `update_summary_for_token()` so counts are consistent.
- **Display**: Sentiment chart and vote components use the same summary; leaderboard and trending use the same API.
- **AI summary**: `TokenSentimentSummaryService` combines vote distribution with recent signal count and average confidence. It does not yet use wallet activity or narratives; those can be added for richer summaries.
- **Recommendation**: Optional sentiment accuracy tracking (e.g. compare bullish % vs price change over a horizon) can be added later for tuning and reporting.

## Abuse Protection

- **One vote per user per token**: `TokenSentimentVote` has unique constraint `(user_id, token_symbol)`. Updating a vote overwrites the previous one.
- **Auth required for voting**: POST `/api/v1/sentiment/vote` requires `get_current_user`; unauthenticated users cannot vote.
- **Comment spam**: Token comments are limited to 5000 chars and require auth. No rate limit is implemented yet; consider per-user or per-token rate limits for production.
- **Anti-manipulation**: No captcha or fingerprinting is in place. For production, consider rate limits, abuse flags, and optional captcha on vote/comment.

## Performance

- **Read path**: GET sentiment and leaderboard/trending are simple queries on `TokenSentimentSummary` (indexed by `token_symbol`). List endpoints use limit and order by count.
- **Write path**: Each vote triggers a full recompute of the summary for that token (aggregate counts from votes). For very high vote volume, consider async job or incremental update.
- **Comments**: Comment list is ordered by `created_at desc` with limit; upvote toggles a single row and updates `comment.upvotes`. No N+1 if comments are loaded without votes detail.

## Integration

- **Signals**: AI sentiment summary uses recent `Signal` count and average confidence for the token.
- **Coin page**: Sentiment panel (`SentimentVote`, `SentimentChart`) and optional `AISentimentSummary` are shown on `/coins/[slug]`.
- **Community**: `/coins/[slug]/community` shows token discussion feed (comments + upvotes). Comment API: GET/POST `/api/v1/tokens/{token}/comments`, POST `/api/v1/tokens/comments/{comment_id}/upvote`.
- **Leaderboard / trending**: `/sentiment` and `/sentiment/trending` consume GET `/api/v1/sentiment/leaderboard` and `/api/v1/sentiment/trending`.

## Data Model Summary

- **TokenSentimentVote**: user_id, token_symbol, sentiment (bullish|neutral|bearish), created_at. Unique (user_id, token_symbol).
- **TokenSentimentSummary**: token_symbol (unique), bullish_count, neutral_count, bearish_count, updated_at.
- **TokenComment**: user_id, token_symbol, content, upvotes, created_at.
- **TokenCommentVote**: comment_id, user_id. Unique (comment_id, user_id).

## Recommendations

1. Add rate limiting on POST vote and POST comment to reduce spam and bot abuse.
2. Optionally track sentiment accuracy (e.g. bullish % vs 7d price change) for analytics.
3. Extend AI summary to include wallet activity and narrative tags when available.
4. Add sentiment history (time-bucketed snapshots) if you need sentiment-over-time charts.
