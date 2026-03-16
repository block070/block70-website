"use client";

import { chartClassNames, chartColors } from "./chart-styles";

type SignalBucket = { label: string; count: number };

type SignalActivityChartProps = {
  data: SignalBucket[];
  height?: number;
};

export function SignalActivityChart({
  data,
  height = 160,
}: SignalActivityChartProps) {
  if (!data.length) return null;

  const maxCount = Math.max(...data.map((d) => d.count));
  const width = 400;
  const padding = { top: 8, right: 8, bottom: 24, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = chartWidth / data.length - 4;

  return (
    <div className={chartClassNames.container}>
      <p className={chartClassNames.title}>Signal activity</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={chartClassNames.svg}
        style={{ height: `${height}px` }}
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const barHeight = maxCount
            ? (d.count / maxCount) * chartHeight
            : 0;
          const x = padding.left + i * (chartWidth / data.length) + 2;
          const y = padding.top + chartHeight - barHeight;
          return (
            <g key={d.label}>
              <rect
                x={x}
                y={y}
                width={Math.max(barWidth, 2)}
                height={barHeight}
                fill={chartColors.primary}
                rx={2}
              />
              <text
                x={x + barWidth / 2}
                y={height - 6}
                textAnchor="middle"
                fill={chartColors.text}
                fontSize="10"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
