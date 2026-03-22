"use client";

import { memo } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// Placeholder 7D data (mock for now - will be replaced with real TVL history)
function makePlaceholderData(): { value: number }[] {
  const arr: { value: number }[] = [];
  for (let i = 0; i < 7; i++) {
    arr.push({ value: 100 + Math.random() * 40 - 20 });
  }
  return arr;
}

type Props = {
  chainName: string;
  tvl: number;
};

export const ChainSparkline = memo(function ChainSparkline({ chainName, tvl }: Props) {
  const data = makePlaceholderData();
  const safeId = chainName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

  return (
    <div className="h-8 w-24" title={`7D Activity - ${chainName}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${safeId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={1}
            fill={`url(#spark-${safeId})`}
            isAnimationActive={false}
          />
          <Tooltip
            content={<></>}
            cursor={false}
            formatter={() => [`$${(tvl / 1e9).toFixed(2)}B TVL`, ""]}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
