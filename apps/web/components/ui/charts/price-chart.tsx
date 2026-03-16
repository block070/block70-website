"use client";

import { chartClassNames, chartColors } from "./chart-styles";

type Point = { x: number; y: number };

type PriceChartProps = {
  data: Point[];
  height?: number;
  showGradient?: boolean;
};

export function PriceChart({
  data,
  height = 200,
  showGradient = true,
}: PriceChartProps) {
  if (!data.length) return null;

  const minY = Math.min(...data.map((p) => p.y));
  const maxY = Math.max(...data.map((p) => p.y));
  const range = maxY - minY || 1;
  const width = 400;
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((p, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y =
      padding.top +
      chartHeight -
      ((p.y - minY) / range) * chartHeight;
    return `${i === 0 ? "M" : "L"} ${x},${y}`;
  });
  const pathD = points.join(" ");
  const areaD = `${pathD} L ${padding.left + chartWidth},${padding.top + chartHeight} L ${padding.left},${padding.top + chartHeight} Z`;
  const isUp = data[data.length - 1]?.y >= data[0]?.y;

  return (
    <div className={chartClassNames.container}>
      <p className={chartClassNames.title}>Price</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={chartClassNames.svg}
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id="priceChartGradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor={isUp ? chartColors.up : chartColors.down}
              stopOpacity="0.4"
            />
            <stop
              offset="100%"
              stopColor={isUp ? chartColors.up : chartColors.down}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        {showGradient && (
          <path
            d={areaD}
            fill="url(#priceChartGradient)"
          />
        )}
        <path
          d={pathD}
          fill="none"
          stroke={isUp ? chartColors.up : chartColors.down}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
