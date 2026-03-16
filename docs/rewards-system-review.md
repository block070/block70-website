# Rewards System Review

## Overview

The Blocks system rewards users for engagement (daily check-in, alpha posts, referrals, signal shares, strategy creation) and lets them spend Blocks in the rewards store. Ledger is backed by `UserBlocks` and `BlockTransaction`.

---

## Models

| Model | Purpose |
|-------|--------|
| **UserBlocks** | id, user_id, balance, last_checkin_at, streak_days, created_at, updated_at |
| **BlockTransaction** | id, user_id, transaction_type (earn | spend | bonus), amount, description, created_at |
| **RewardAction** | id, action_type, reward_amount, description — configurable reward amounts per action |
| **RewardItem** | id, name, description, block_cost, reward_type — store items |

Leaderboard is computed from `UserBlocks.balance` (no separate BlocksLeaderboard table).

---

## Reward Logic

| Action | Default Blocks | When |
|--------|----------------|------|
| daily_checkin | 5 | Once per calendar day (UTC) |
| streak_3 | 10 | Bonus when streak ≥ 3 days |
| streak_7 | 25 | Bonus when streak ≥ 7 days |
| streak_30 | 100 | Bonus when streak ≥ 30 days |
| referral_signup | 25 | When referred user signs up (referrer gets Blocks) |
| referral_active | 50 | (Wire when referral becomes “active” if defined) |
| alpha_post | 10 | When user creates an alpha post |
| alpha_upvotes | 2 | (Wire when post receives upvotes if desired) |
| alpha_accurate | 20 | (Wire when alpha proven accurate) |
| strategy_created | 15 | When user creates a strategy |
| strategy_performed | 30 | (Wire when strategy performs well) |
| signal_share | 3 | When user records a signal share |

Amounts can be overridden in DB via `RewardAction` rows; engine falls back to `DEFAULT_REWARDS` if no row exists.

---

## Ledger Accuracy

- **Earn**: `award_blocks()` adds positive amount to `UserBlocks.balance` and inserts `BlockTransaction` (type earn/bonus).
- **Spend**: `redeem_reward()` subtracts cost from balance and inserts `BlockTransaction` (type spend, amount negative).
- Balance is the single source of truth; it is updated in the same transaction as the corresponding `BlockTransaction`. No separate double-entry; for audit, sum `BlockTransaction.amount` per user should match current balance if no manual edits.

---

## Daily Check-in & Streaks

- **POST /api/v1/rewards/checkin**: Enforces one check-in per calendar day (UTC). If last check-in was yesterday, streak increments; otherwise streak resets to 1. Awards base daily_checkin Blocks plus one of streak_3 / streak_7 / streak_30 when applicable.
- `UserBlocks.last_checkin_at` (date) and `UserBlocks.streak_days` store state.

---

## Anti-Abuse

- **Check-in**: One per calendar day; duplicate returns "Already checked in today".
- **Signal share**: Capped at 20 rewards per hour per user (same action_type) via `_recent_action_count` and `MAX_ACTION_PER_HOUR`.
- **Referral**: One Referral row per (referrer, referred) pair; signup awards Blocks once to referrer.
- **Duplicate referrals / bot accounts**: No additional checks yet; can add IP or device fingerprinting, or require referred user to complete an action before awarding referral_active.

---

## API

| Endpoint | Description |
|----------|-------------|
| GET /api/v1/blocks/balance | Balance, streak_days, last_checkin_at |
| GET /api/v1/blocks/transactions | Paginated transaction history |
| POST /api/v1/rewards/checkin | Daily check-in (and streak bonuses) |
| GET /api/v1/rewards/store | List reward items |
| POST /api/v1/rewards/redeem/{item_id} | Spend Blocks on item |
| GET /api/v1/leaderboard/blocks | Rank users by balance (no auth) |

---

## Store & Redemption

- **RewardItem**: Store items with block_cost and reward_type (e.g. premium_access, signal_alerts, strategy_credits). Redemption is recorded; granting the actual benefit (e.g. premium days) is application-specific and can be wired in `redeem_engine` or downstream.
- **redeem_engine.redeem_reward()**: Checks balance ≥ cost, deducts balance, inserts spend transaction.

---

## Frontend

- **BlockBalance** (navbar): Shows balance, links to /rewards/store.
- **/rewards/store**: Store list, balance, daily check-in CTA, redeem buttons.
- **/leaderboard**: Table of rank, name, balance (top 100).

---

## Performance

- Balance read: single row per user (`UserBlocks`).
- Transactions: indexed by user_id and created_at; paginated.
- Leaderboard: join User + UserBlocks, order by balance, limit 100; consider materialized view or cache if needed at scale.
- Check-in and award_blocks do one balance update + one insert per action; acceptable for moderate traffic.

---

## Checklist

| Item | Status |
|------|--------|
| UserBlocks, BlockTransaction, RewardAction, RewardItem | Done |
| reward_engine (award_blocks, check-in, streaks) | Done |
| redeem_engine | Done |
| Blocks API (balance, transactions) | Done |
| Check-in endpoint + streak bonuses | Done |
| Store + redeem API | Done |
| Leaderboard API | Done |
| Referral signup → Blocks | Done |
| Alpha post → Blocks | Done |
| Strategy created → Blocks | Done |
| Signal share → Blocks | Done |
| Anti-abuse (check-in once/day, signal_share cap) | Done |
| Block balance indicator (navbar) | Done |
| /rewards/store page | Done |
| /leaderboard page | Done |
| Seed RewardAction + RewardItem | Done |

---

## Optional Next Steps

- **referral_active**: Award Blocks when referred user completes a defined “active” action (e.g. first signal view, first strategy).
- **alpha_upvotes / alpha_accurate**: Call `award_blocks` from alpha vote handler and from outcome/accuracy pipeline.
- **strategy_performed**: Call `award_blocks` when backtest or live performance crosses a threshold.
- **Reward redemption fulfillment**: When redeeming premium_access, extend user’s premium end date; for signal_alerts, increment a counter or unlock feature.
- **BlocksLeaderboard table**: Optional cache updated periodically if leaderboard query becomes heavy.
