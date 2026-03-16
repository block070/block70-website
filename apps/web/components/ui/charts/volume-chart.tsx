"use client";

import { chartClassNames, chartColors } from "./chart-styles";

type VolumeBar = { x: number; value: number };

type VolumeChartProps = {
  data: VolumeBar[];
  height?: number;
};

export function VolumeChart({ data, height = 120 }: VolumeChartProps) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map((d) => d.value));
  const width = 400;
  const padding = { top: 8, right: 8, bottom: 8, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / data.length - 2;

  return (
    <div className={chartClassNames.container}>
      <p className={chartClassNames.title}>Volume</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={chartClassNames.svg}
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const barHeight = maxVal ? (d.value / maxVal) * chartHeight : 0;
          const x = padding.left + i * (chartWidth / data.length);
          const y = padding.top + chartHeight - barHeight;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(barWidth, 2)}
              height={barHeight}
              fill={chartColors.volume}
              rx={1}
            />
          );
        })}
      </svg>
    </div>
  );
}
