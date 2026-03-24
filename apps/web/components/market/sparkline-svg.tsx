"use client";

import { memo } from "react";

type Props = {
  points: number[];
  width?: number;
  height?: number;
  positive: boolean;
};

/** Inline SVG sparkline — no chart libraries. */
function SparklineSvgInner({ points, width = 100, height = 30, positive }: Props) {
  if (!points.length) {
    return (
      <span
        className="inline-block bg-slate-800/80"
        style={{ width, height }}
        aria-hidden
      />
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const range = max - min || 1;
  const d = points
    .map((y, i) => {
      const x = pad + (i / (points.length - 1 || 1)) * w;
      const py = pad + h - ((y - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const stroke = positive ? "#34d399" : "#f87171";
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export const SparklineSvg = memo(SparklineSvgInner);
