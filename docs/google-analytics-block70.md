# Google Analytics 4 (Block70 web)

## One-time setup (Google Analytics UI)

1. In [Google Analytics](https://analytics.google.com/), create or use an account and add a **GA4 property** for Block70.
2. Add a **Web** data stream with production URL `https://block70.com` (and staging/preview URLs if used).
3. Copy the **Measurement ID** (`G-XXXXXXXXXX`).
4. In **Admin → Data display → Events**, tune **Enhanced measurement** as needed.
5. For funnels, use **Explore → Funnel exploration**; mark important events as **Key events** (conversions) under **Admin → Data display → Key events**.

## Environment

Set in hosting (e.g. Vercel) and locally in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

The ID is public (sent to the browser). See `apps/web/.env.example` for the placeholder.

## Behavior in the app

- GA scripts load **only after** the user accepts cookies (`block70-cookie-consent` in `localStorage`).
- There is a **single** gtag bootstrap and `send_page_view: false` on config; **SPA navigations** send `page_view` via `components/analytics/ga-page-view.tsx` so hits are not duplicated on first load.
- Custom events: `gaEvent()` in `apps/web/lib/analytics/gtag.ts` (example: `upgrade_click` from the sticky upgrade pill).

## Verification

1. Deploy or run locally with `NEXT_PUBLIC_GA_MEASUREMENT_ID` set.
2. Accept cookies in the banner.
3. Open GA4 **Reports → Realtime** and confirm your session.
4. Use **Admin → DebugView** with [GA Debugger](https://support.google.com/analytics/answer/7201382) or `?debug_mode=true` on the site URL while testing.
5. Confirm only one gtag load in the Network tab (`gtag/js?id=G-…`).
