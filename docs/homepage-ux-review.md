# Homepage UX Review

## Visual hierarchy

- **Hero market overview** is the primary focus: large typography for total market cap, 24h volume, BTC/ETH dominance, and top trending coin. Gradient background and single CTA area create a clear entry point.
- **Market stats bar** provides quick-scan prices (BTC, ETH, SOL) and top gainer/loser without competing with the hero.
- **Section headings** use consistent `text-sm font-semibold text-slate-50` with optional `text-[11px] text-slate-400` subtitles so each block is scannable.
- **Cards and borders**: `border-slate-800`, `bg-slate-950/70` keep sections distinct; "View all" / "View feed" links are secondary (blue-400) so primary content stays dominant.

## Readability

- Body text uses `text-xs` or `text-sm` with `text-slate-200`/`text-slate-400` for contrast on dark background.
- Line clamping (`line-clamp-2`) prevents long titles from breaking layout.
- Sufficient spacing between sections (`space-y-6`) and within cards (`p-4`, `gap-3`) so content doesn’t feel cramped.

## Mobile usability

- **Responsive grid**: Sections use `grid gap-4 md:grid-cols-2 lg:grid-cols-3` (or similar) so columns stack on small screens and expand on larger ones.
- **Stack order**: Hero and market stats are first; gainers/losers and heatmap follow; then trending, signals, opportunities, whale, airdrop, user dashboard, narratives, news. Order is consistent and vertical on mobile.
- **Touch targets**: Buttons and links meet minimum size (e.g. quick-nav cards, "View all" links). Global CSS enforces 44px minimum for coarse pointers where applicable.
- **Horizontal scroll**: Market stats bar and heatmap use `flex flex-wrap` or `flex-wrap gap-2` so they wrap instead of forcing horizontal scroll on narrow viewports.

## Performance

- **Server-side rendering**: Homepage is a server component; data is fetched in one pass (`getOpportunities`, `getSignalsLatest`, etc.) with `revalidate = 60` for caching.
- **Lazy loading**: Below-fold sections (SignalsFeed, TopOpportunities, TrendingCoins, WhaleActivity, AirdropHighlights) use `dynamic()` with `loading` skeletons so the initial paint is fast and heavier sections stream in.
- **API caching**: Backend calls use `cache: "no-store"` or `next: { revalidate }` as appropriate; consider adding a dedicated news endpoint and caching it for the news section.

## Animations

- **Subtle transitions**: Signal and opportunity cards use `transition-opacity duration-300` so updates don’t feel abrupt. More advanced "new item" animations can be added later (e.g. slide-in) when live updates push new items.
- **Skeleton loading**: Dynamic sections show pulse skeletons while loading, improving perceived performance.

## Intuitiveness and engagement

- **Quick navigation** gives one-tap access to Signals, Opportunities, Airdrops, Wallet Tracker, Narratives so power users can jump to key areas.
- **User dashboard** (tracked coins, wallets, alerts, strategies) personalizes the experience and encourages return visits.
- **Consistent "View all" / "View feed"** patterns set expectations: each section has a clear path to the full list or feed.

## Recommendations

1. Add an optional **live update** indicator (e.g. "Updated 30s ago") and poll the backend `/api/v1/live/snapshot` (or equivalent) to refresh signals/trending without full page reload.
2. **News section**: Connect to a real news API or backend list endpoint when available; fallback to placeholder content is in place.
3. **A/B test** hero layout (single row vs. stacked on mobile) if metrics show drop-off on small screens.
4. Run **Lighthouse** (performance, accessibility) and fix any regressions; ensure focus order and ARIA labels for interactive elements.
