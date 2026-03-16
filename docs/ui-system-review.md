# Block70 UI/UX System Review

## Layout and navigation

- **Top navigation bar**: Fixed at top with Block70 logo, global search (instant results), links (Market, Signals, Airdrops, Wallets, Opportunities, News), and Account. Stays visible while scrolling.
- **Sidebar**: Left sidebar with grouped sections (Market, Intelligence, Discovery, Analytics). Icons and tooltips on nav items. Collapses on mobile with overlay; hamburger toggles. Desktop: sidebar is in flow so main content is beside it.
- **Main content**: Max-width container, consistent padding. Optional right insight panel (hidden on smaller breakpoints, shown on xl).
- **Clarity**: Single primary CTA per section; breadcrumbs or back links where needed. Active state uses primary (blue) for current page.

## Page load and performance

- **SSR**: Homepage, dashboard, opportunities, signals, coin pages use server components and `revalidate` where appropriate (30–60s).
- **Lazy loading**: Heavy or below-fold content can use `dynamic(..., { loading: () => <Skeleton /> })` for charts and panels.
- **API caching**: `fetch` with `cache: "no-store"` for live data; consider `next: { revalidate: 60 }` for non-critical endpoints.
- **Images**: Use Next.js `Image` with dimensions and priority for LCP when images are added.

## Mobile usability

- **Responsive grids**: Homepage and dashboards use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (or similar) so columns stack on small screens.
- **Collapsible sidebar**: Sidebar is off-canvas on mobile; toggle opens overlay and drawer. Touch target for toggle is at least 44px.
- **Touch-friendly**: `globals.css` enforces minimum 44px touch targets for buttons and links on coarse pointers.
- **Scroll**: Horizontal nav in top bar uses `overflow-x-auto` and `scrollbar-hide` so it scrolls on small screens without taking full width.

## Visual hierarchy

- **Background**: Dark gray (slate-950) base; cards use slate-950/70 or slate-900/60 for elevation.
- **Primary**: Neon blue (blue-500) for primary actions, active nav, focus rings.
- **Secondary**: Crypto green (emerald-500) for success, positive change, secondary CTAs.
- **Alerts**: Orange (orange-500) for warnings and alert badges.
- **Text**: slate-50 for headings, slate-200/300 for body, slate-400/500 for muted.
- **Contrast**: Focus visible ring (blue-500, 2px) for accessibility; sufficient contrast for text on dark backgrounds.

## Real-time updates

- **RealtimeProvider**: Optional context for polling (e.g. every 30s). Components can call `refresh()` or use `lastUpdated` to show “Updated at …”.
- **Signals feed**: Client component can poll `getSignalsLatest` on an interval when “Auto-refresh” is on.
- **Future**: WebSockets can replace polling for signals, market data, and wallet trades when backend supports it.

## Component library

- **Button**: Variants primary (blue), secondary (emerald), ghost, alert. Focus and disabled states.
- **Card / CardHeader**: Elevated container and optional header with title, subtitle, action.
- **Badge**: default, primary, secondary, alert, muted.
- **Tooltip**: Hover/focus to show label; used on sidebar items.
- **Tables**: Used on trending, leaderboard; responsive with overflow-x-auto where needed.
- **Charts**: Existing coin chart and market stats; can be lazy-loaded.
- **Tags**: Badge component doubles as tags for type/chain/status.

## Recommendations

1. **Navigation**: Add a “Capital Flow” or “Smart money” entry in the top nav if it becomes a primary destination.
2. **Page speed**: Add loading.tsx for heavy routes (opportunities, signals) with skeleton cards.
3. **Mobile**: Test sidebar open/close and form inputs on real devices; consider bottom nav for critical paths.
4. **Hierarchy**: Keep one main headline per page; use CardHeader subtitles for section context.
5. **Real-time**: When WebSockets are available, switch from polling to push for signals and wallet trades to reduce load and improve latency.
