# Block70 Design System Review

## Consistency

- **Tokens**: Colors, typography, spacing, border radius, and shadows are defined in `tailwind.config.ts` and `app/globals.css`. Components use semantic tokens (`--b70-bg`, `--b70-card`, `--b70-border`, `--b70-text`, `--b70-text-muted`) and palette (`crypto-blue`, `crypto-green`, `crypto-orange`) so updates propagate.
- **Typography**: Inter (UI) and JetBrains Mono (numeric) are loaded via `next/font`. Utility classes `.heading-xl`, `.heading-lg`, `.heading-md`, `.body`, `.small`, `.numeric` keep type hierarchy consistent.
- **Spacing**: Scale is 4, 8, 12, 16, 24, 32, 48px (Tailwind spacing 1–12). Use `p-4`, `gap-4`, `space-y-6` etc. for predictable rhythm.
- **Components**: Card, Button, Badge, DataTable, Tooltip, and Skeletons use the same tokens and variants so they look and behave consistently across the app.

## Dark mode behavior

- **Class-based**: Tailwind `darkMode: "class"` is used. The `dark` class on `<html>` switches the theme.
- **CSS variables**: Light/dark values are set in `:root` and `.dark` in `globals.css`. Components reference `var(--b70-bg)`, `var(--b70-card)`, etc., so they adapt without duplicate class names.
- **Theme provider**: `contexts/theme-context.tsx` holds theme state, syncs with `localStorage` (`block70-theme`), and toggles the `dark` class. An inline script in layout runs before paint to avoid flash.
- **Theme toggle**: `components/ui/theme-toggle.tsx` switches between light and dark and persists the choice. All UI that uses design tokens (Card, Button, Badge, DataTable, Tooltip, nav) adapts automatically.

## Responsive layout

- **Breakpoints**: Default Tailwind breakpoints (sm, md, lg, xl) are used. Layouts use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` and similar for stacking on mobile.
- **Touch**: `globals.css` enforces minimum 44px touch targets for buttons and links on coarse pointers.
- **Tables**: `DataTable` is wrapped in `overflow-x-auto` so it scrolls horizontally on small screens instead of breaking the layout.

## Component reusability

- **Card**: Accepts `hover` for lift/border/shadow. `CardHeader` supports title, subtitle, and action slot. Use for any content block.
- **Button**: Variants are primary, secondary, outline, ghost. Add more variants in `variantClass` if needed.
- **Badge**: Variants include default, primary, secondary, alert, muted, signal-type, confidence, difficulty, narrative. Easy to extend.
- **DataTable**: Generic `<DataTable<T>>` with `columns`, `data`, `keyExtractor`. Reusable for coins, wallets, signals, or any tabular data.
- **Tooltip**: Wraps any child; `label` and optional `side` (top/bottom/left/right). Theme-aware via CSS variables.
- **Skeletons**: `Skeleton`, `CoinTableSkeleton`, `SignalsFeedSkeleton`, `ChartSkeleton` cover common loading states.
- **Charts**: `PriceChart`, `VolumeChart`, `MarketHeatmapChart`, `SignalActivityChart` share `chart-styles.ts` (grid, neon colors, dark background). Use the same pattern for new chart types.
- **Icons**: `SignalsIcon`, `WalletsIcon`, `AirdropsIcon`, `CoinsIcon`, `NarrativesIcon`, `NewsIcon` from `components/ui/icons.tsx` (Lucide-based) keep icon usage consistent.

## Hover interactions

- **Cards**: Card uses `hover:-translate-y-0.5`, `hover:border-[var(--b70-crypto-blue)]/30`, and `hover:shadow-b70-card-hover` for lift, border highlight, and shadow (configurable via `hover` prop).
- **Tables**: Rows use `hover:bg-[var(--b70-border)]/20`.
- **Buttons**: Variants already include `hover:` and `active:` states in `button.tsx`.

## Scroll performance and virtualization

- **Large lists**: For very long lists (e.g. 500+ signals or coin rows), add virtualization (e.g. `@tanstack/react-virtual` or `react-window`) so only visible rows are rendered. The design system does not include a virtual list component yet; introduce one when a feed or table exceeds ~100 rows and scroll performance degrades.
- **Current usage**: Signals feed and coin tables can stay as regular lists until list size justifies virtualization.

## Recommendations

1. **Document tokens**: Keep a single source of truth (e.g. a design-system.md or Storybook) that lists all tokens and component APIs so new screens stay consistent.
2. **Contrast**: In light mode, ensure text on `--b70-card` and `--b70-bg` meets WCAG AA. Current `#111827` on `#F8FAFC` and `#FFFFFF` is sufficient.
3. **Charts**: If you add a full charting library (e.g. Recharts), align its theme (grid, colors) with `chart-styles.ts` so price/volume/heatmap stay consistent.
4. **Icon set**: Expand `icons.tsx` with more Lucide icons as needed; keep a single file so icon usage stays traceable.
