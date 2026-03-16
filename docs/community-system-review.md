# Community alpha system review

## Overview

The community alpha system lets users create **AlphaPost** (trade_idea, signal, strategy, research), comment (**AlphaComment**), vote (**AlphaVote**), and track **UserReputation** and **UserFollow**. Trending and leaderboard use votes, engagement, author reputation, and recency. **Alpha accuracy** is updated when posts are evaluated against market outcomes.

## Post creation

- **Flow**: Authenticated user submits title, content, token_symbol, alpha_type, confidence_score via `POST /api/v1/alpha/posts`. Backend creates `AlphaPost` and returns enriched post (author_name, vote_score, comment_count).
- **Validation**: title/content required; alpha_type one of trade_idea, signal, strategy, research; confidence_score 0–1. No server-side rate limit on create; consider per-user limits for abuse prevention.
- **Recommendations**: Add max length for content (e.g. 10k chars); optional rich text or markdown; rate limit (e.g. 10 posts/hour per user).

## Voting logic

- **Model**: Each user can have one vote per post (up or down). New vote replaces previous. `vote_score` = up - down.
- **API**: `POST /api/v1/alpha/vote` with body `{ post_id, vote_type: "up"|"down" }`. Returns new vote_score.
- **Recommendations**: Consider preventing vote on own post; optional vote expiry or “vote changed at” for audit.

## Reputation scoring

- **UserReputation**: reputation_score, alpha_accuracy, followers. Created on first need (e.g. first post or first follow).
- **Updates**: Followers count updated when users follow/unfollow. Alpha accuracy updated by **alpha_accuracy** service when a post is evaluated (e.g. price moved in predicted direction).
- **Trending**: `trending_alpha_engine.rank()` combines vote_score (×2), comment_count (×1), author reputation (×0.5), recency (×10). Weights are tunable.
- **Recommendations**: Persist reputation on a schedule or on follow/accuracy events; consider decay for reputation over time; expose formula in docs.

## Performance

- **List posts**: Single query with optional filters (token_symbol, alpha_type), offset/limit. Enrichment (author_name, vote_score, comment_count) does N+1 or extra queries per post; consider batch load of users and aggregate vote/comment counts in one query per page.
- **Trending**: Loads all posts since `since_hours`, then in Python computes vote/comment/reputation/recency. For large volumes, move to SQL (e.g. subqueries for vote_score, comment count, join UserReputation) and order in DB.
- **Leaderboard**: Single join UserReputation + User, ordered by reputation_score, alpha_accuracy. Index on (reputation_score, alpha_accuracy) if needed.
- **Recommendations**: Add database indexes on (user_id, created_at) for posts, (post_id, user_id) for votes/comments; cache trending and leaderboard with short TTL (e.g. 60s).

## API reliability

- **Auth**: Create post, vote, comment require `Authorization: Bearer <token>`. List posts, get post, comments, trending, leaderboard, user profile/posts are public or use optional auth.
- **Errors**: 404 for missing post/user; 401 for unauthenticated create/vote/comment. Validation errors return 422.
- **Follow**: POST body `{ following_id }`; DELETE uses query `?following_id=`. Idempotent follow (already following returns 200 with status).

## Signal engine integration

- **Requirement**: “Generate signals when high-confidence alpha posts gain traction.”
- **Approach**: In the pipeline (e.g. after trending run or on post update), if a post has confidence_score >= threshold (e.g. 0.8) and vote_score or engagement above threshold, create or attach a **Signal** (or feed into existing signal engine) with source “community_alpha” and reference to post_id. Document in signal engine and community docs.

## Alpha notifications

- **Alert types**: `alpha_followed_user_post`, `alpha_high_confidence` added to available alert types. Implementation: when a new AlphaPost is created, if the author is in the current user’s following list, emit “followed user posted”; if post confidence_score >= threshold, emit “high-confidence alpha.” Delivery can reuse existing premium alert delivery (e.g. same channels).

## Data accuracy

- **Alpha accuracy**: Updated by `alpha_accuracy_service.evaluate_post_accuracy()` when outcome is known; `update_reputation_from_prices()` compares PriceSnapshot at post time vs later. Correctness depends on snapshot quality and the chosen time horizon (e.g. 24h). Document that accuracy is heuristic and not a guarantee.
