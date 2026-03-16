"use client";

import Link from "next/link";
import { chartClassNames, chartColors } from "./chart-styles";

type HeatmapCell = { symbol: string; value: number };

type MarketHeatmapChartProps = {
  data: HeatmapCell[];
  maxItems?: number;
};

function colorForValue(value: number): string {
  if (value >= 5) return chartColors.up;
  if (value >= 0) return "rgba(0, 255, 163, 0.6)";
  if (value >= -3) return "rgba(255, 107, 107, 0.6)";
  return chartColors.down;
}

export function MarketHeatmapChart({
  data,
  maxItems = 24,
}: MarketHeatmapChartProps) {
  const list = data.slice(0, maxItems);

  return (
    <div className={chartClassNames.container}>
      <p className={chartClassNames.title}>Market heatmap</p>
      <div className="flex flex-wrap gap-2">
        {list.map((cell) => (
          <Link
            key={cell.symbol}
            href={`/coins/${cell.symbol.toLowerCase()}`}
            className="rounded-b70-sm px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: colorForValue(cell.value) }}
            title={`${cell.symbol} ${cell.value >= 0 ? "+" : ""}${cell.value}%`}
          >
            {cell.symbol}
          </Link>
        ))}
      </div>
    </div>
  );
}
