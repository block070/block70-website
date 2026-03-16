# Growth System Review

This document summarizes the viral growth and analytics features implemented in Block70.

## Sharing

- **SharedSignal model**: Records when a user shares a signal to a platform (`signal_id`, `shared_by_user`, `share_platform`, `created_at`).
- **Signal card generator** (`services/social/signal_card_generator.py`): Generates shareable PNG images with token symbol, signal type, confidence score, timestamp, and Block70 branding.
- **API**:
  - `GET /api/v1/signals/share-card/{signal_id}`: Returns PNG image (no auth).
  - `POST /api/v1/signals/share/{signal_id}?platform=twitter|telegram|discord|copy`: Records share (auth required).
- **Frontend**: `components/social/share-buttons.tsx` — Twitter/X, Telegram, Discord, Copy link. Optional `signalId` records the share when user clicks.

## Referral program

- **Referral model**: `referrer_user_id`, `referred_user_id`, `created_at`, `reward_status`.
- **User.referral_code**: Unique code per user (e.g. for `block70.com/signup?ref=USER123`).
- **Referral service** (`services/referral_service.py`): `ensure_user_referral_code`, `get_referral_link`, `resolve_referrer_by_code`, `create_referral_record`.
- **Auth**: Registration accepts optional `ref_code`; creates a `Referral` row when the new user signs up with a valid code.
- **API**: `GET /api/v1/referrals/me`, `GET /api/v1/referrals/dashboard` (code, link, referral count, rewards earned).
- **Frontend**: `/referrals` — referral link, count, rewards earned, share buttons.

## Creator rewards

- **CreatorReward model**: `user_id`, `reward_type`, `reward_amount`, `created_at`.
- **Alpha reward engine** (`services/community/alpha_reward_engine.py`): Rewards for alpha engagement (votes), correct signals, and strategy performance. Updates `UserReputation.reputation_score`.

## Public strategies

- **TradingStrategy.is_public**: New field; public strategies appear in sitemap and public listing.
- **API**:
  - `GET /api/v1/trading-strategies/public`: List public strategies (no auth).
  - `GET /api/v1/trading-strategies/public/{id}`: Get one public strategy (no auth).
  - `GET /api/v1/trading-strategies/leaderboard?public_only=true`: Leaderboard of public strategies only.
- **Frontend**: `/strategies/[id]` — public strategy page (rules, performance, backtest, share buttons). `/strategies/top` — top public strategies by ROI/win rate.

## SEO

- **Alpha posts**: Sitemap includes `/alpha/posts/{id}` for each alpha post.
- **Public strategies**: Sitemap includes `/strategies/{id}` for each public strategy.
- **Sitemap**: `GET /sitemap.xml` (coins, narratives, news, alpha posts, public strategies). Base URL via `SITEMAP_BASE_URL`.

## User notifications

- **UserNotification model**: `user_id`, `notification_type`, `content`, `created_at`.
- **Notification engine** (`services/notifications/notification_engine.py`): `notify_user`, `notify_new_signal`, `notify_alpha_post`, `notify_strategy_alert`.
- **API**: `GET /api/v1/notifications` — list current user notifications.

## Email digest

- **Daily digest** (`services/email/digest_generator.py`): `generate_daily_digest` — top signals, top opportunities (from pipeline digest), top alpha posts. Payload suitable for a daily email sender.

## User growth analytics

- **UserActivity model**: `user_id`, `activity_type`, `timestamp` (for DAU and engagement).
- **Admin analytics API**: `GET /api/v1/admin/analytics` (admin only) — total users, new users 7d/30d, DAU, notifications 7d, referrals 7d.
- **Frontend**: `/admin/analytics` — growth dashboard (admin only).

## Checklist

| Area              | Item                    | Status |
|-------------------|-------------------------|--------|
| Sharing           | SharedSignal model      | Done   |
| Sharing           | Signal card generator   | Done   |
| Sharing           | Share buttons (X, TG, Discord, copy) | Done |
| Referral          | Referral model          | Done   |
| Referral          | Referral code & link    | Done   |
| Referral          | Rewards (premium/rep/badges) | Backend model; grant flow can be wired |
| Referral          | Referral dashboard      | Done   |
| Creator rewards   | CreatorReward model     | Done   |
| Creator rewards   | Alpha reward engine     | Done   |
| Public strategies | is_public + public API  | Done   |
| Public strategies | Strategy pages & leaderboard | Done |
| SEO               | Alpha in sitemap        | Done   |
| SEO               | Strategies in sitemap   | Done   |
| Notifications     | Model + engine + API    | Done   |
| Email digest      | Daily digest payload    | Done   |
| Analytics         | UserActivity model      | Done   |
| Analytics         | Admin analytics API & page | Done |

## Next steps (optional)

- Wire referral rewards: when `reward_status` is updated (e.g. after referred user completes onboarding), grant premium days / reputation / badges via `CreatorReward` or subscription.
- Log `UserActivity` on login, signal view, alpha post view, strategy view so DAU is accurate.
- Send daily email using `generate_daily_digest` and an email provider (SendGrid, Postmark, etc.).
- Add SEO metadata (e.g. Next.js `metadata` / `generateMetadata`) for alpha post pages and strategy pages (e.g. title: "SOL Trade Idea | Block70").
