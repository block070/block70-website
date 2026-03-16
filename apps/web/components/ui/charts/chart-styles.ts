/**
 * Block70 chart style system.
 * Use for price charts, volume charts, market heatmaps.
 * - Thin grid lines
 * - Neon highlight colors (crypto-blue, crypto-green, crypto-orange)
 * - Dark background
 */

export const chartColors = {
  grid: "var(--b70-border)",
  text: "var(--b70-text-muted)",
  up: "#00FFA3",      // crypto-green
  down: "#FF6B6B",    // red for losses
  neutral: "#8B949E",
  primary: "#2A7FFF", // crypto-blue
  volume: "rgba(42, 127, 255, 0.3)",
} as const;

export const chartClassNames = {
  container:
    "rounded-b70-md border border-[var(--b70-border)] bg-[var(--b70-card)] p-4",
  title: "small text-[var(--b70-text-muted)] uppercase tracking-wide mb-3",
  svg: "w-full h-full min-h-[200px]",
} as const;
