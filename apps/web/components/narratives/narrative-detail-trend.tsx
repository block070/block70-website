"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NarrativeDailyPoint } from "@/lib/types";

type Props = {
  dailySeries: NarrativeDailyPoint[];
};

export function NarrativeDetailTrend({ dailySeries }: Props) {
  const rows = dailySeries.map((d) => ({ ...d, short: d.date.slice(5) }));
  const hasPoints = rows.some((r) => r.attention > 1e-9);

  if (!hasPoints) {
    return (
      <p className="text-xs text-[var(--b70-text-muted)]">
        No daily attention in the last 14 days for linked opportunities.
      </p>
    );
  }

  return (
    <div className="h-[200px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="narrAttn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--b70-crypto-blue)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--b70-crypto-blue)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--b70-border)" />
          <XAxis dataKey="short" tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }} />
          <YAxis tick={{ fill: "var(--b70-text-muted)", fontSize: 10 }} width={36} />
          <Tooltip
            contentStyle={{
              background: "var(--b70-card)",
              border: "1px solid var(--b70-border)",
              borderRadius: "8px",
            }}
          />
          <Area
            type="monotone"
            dataKey="attention"
            stroke="var(--b70-crypto-blue)"
            fill="url(#narrAttn)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
